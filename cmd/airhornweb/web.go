package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	log "github.com/Sirupsen/logrus"
	"github.com/antage/eventsource"
	"github.com/bwmarrin/discordgo"
	"github.com/gorilla/handlers"
	"github.com/gorilla/sessions"
	"golang.org/x/oauth2"
	redis "gopkg.in/redis.v3"
	"io/ioutil"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"
)

var (
	// Permission Constants
	READ_MESSAGES = 1024
	SEND_MESSAGES = 2048
	CONNECT       = 1048576
	SPEAK         = 2097152

	// Redis client (for stats)
	rcli *redis.Client

	// Oauth2 Config
	oauthConf *oauth2.Config

	// Used for storing session information in a cookie
	store *sessions.CookieStore

	// Used for pushing live stat updates to the client
	es eventsource.EventSource

	// Source of the HTML page (cached in memory for performance)
	htmlIndexPage string

	// Base URL of the discord API
	apiBaseUrl = "https://discordapp.com/api"
)

// Represents a JSON struct of stats that are updated every second and pushed to the client
type CountUpdate struct {
	Total          string `json:"total"`
	UniqueUsers    string `json:"unique_users"`
	UniqueGuilds   string `json:"unique_guilds"`
	UniqueChannels string `json:"unique_channels"`
	SecretCount    string `json:"secret_count"`
}

func (c *CountUpdate) ToJSON() []byte {
	data, _ := json.Marshal(c)
	return data
}

func NewCountUpdate() *CountUpdate {
	var (
		totalCmd  *redis.StringCmd
		usersCmd  *redis.IntCmd
		guildsCmd *redis.IntCmd
		chansCmd  *redis.IntCmd
		secretCmd *redis.StringCmd
	)

	// Make a pipelined request to redis for all the counter values
	errors, err := rcli.Pipelined(func(pipe *redis.Pipeline) error {
		totalCmd = pipe.Get("airhorn:a:total")
		usersCmd = pipe.SCard("airhorn:a:users")
		guildsCmd = pipe.SCard("airhorn:a:guilds")
		chansCmd = pipe.SCard("airhorn:a:channels")
		secretCmd = pipe.Get("airhorn:a:sound:truck")
		return nil
	})

	// Generally this is not a huge deal, lets try to continue on
	if err != nil {
		log.WithFields(log.Fields{
			"error":  err,
			"errors": errors,
		}).Warning("Failed to get a count update from redis")
	}

	secretCount := secretCmd.Val()
	if secretCount == "" {
		secretCount = "0"
	}

	return &CountUpdate{
		Total:          totalCmd.Val(),
		UniqueUsers:    strconv.FormatInt(usersCmd.Val(), 10),
		UniqueGuilds:   strconv.FormatInt(guildsCmd.Val(), 10),
		UniqueChannels: strconv.FormatInt(chansCmd.Val(), 10),
		SecretCount:    secretCmd.Val(),
	}
}

var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

// Return a random character sequence of n length
func randSeq(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// Returns the current session or aborts the request
func getSessionOrAbort(w http.ResponseWriter, r *http.Request) *sessions.Session {
	session, err := store.Get(r, "session")

	if session == nil {
		log.WithFields(log.Fields{
			"error": err,
		}).Error("Failed to get session")
		http.Error(w, "Invalid or corrupted session", http.StatusInternalServerError)
		return nil
	}

	return session
}

// Redirects to the oauth2
func handleLogin(w http.ResponseWriter, r *http.Request) {
	session := getSessionOrAbort(w, r)
	if session == nil {
		return
	}

	// Create a random state
	session.Values["state"] = randSeq(32)
	session.Save(r, w)

	// OR the permissions we want
	perms := READ_MESSAGES | SEND_MESSAGES | CONNECT | SPEAK

	// Return a redirect to the ouath provider
	url := oauthConf.AuthCodeURL(session.Values["state"].(string), oauth2.AccessTypeOnline)
	http.Redirect(w, r, url+fmt.Sprintf("&permissions=%v", perms), http.StatusTemporaryRedirect)
}

func handleCallback(w http.ResponseWriter, r *http.Request) {
	session := getSessionOrAbort(w, r)
	if session == nil {
		return
	}

	// Check the state string is correct
	state := r.FormValue("state")
	if state != session.Values["state"] {
		log.WithFields(log.Fields{
			"expected": session.Values["state"],
			"received": state,
		}).Error("Invalid OAuth state")
		http.Redirect(w, r, "/?key_to_success=0", http.StatusTemporaryRedirect)
		return
	}

	errorMsg := r.FormValue("error")
	if errorMsg != "" {
		log.WithFields(log.Fields{
			"error": errorMsg,
		}).Error("Received OAuth error from provider")
		http.Redirect(w, r, "/?key_to_success=0", http.StatusTemporaryRedirect)
		return
	}

	token, err := oauthConf.Exchange(oauth2.NoContext, r.FormValue("code"))
	if err != nil {
		log.WithFields(log.Fields{
			"error": err,
			"token": token,
		}).Error("Failed to exchange token with provider")
		http.Redirect(w, r, "/?key_to_success=0", http.StatusTemporaryRedirect)
		return
	}

	body, _ := json.Marshal(map[interface{}]interface{}{})
	req, err := http.NewRequest("GET", apiBaseUrl+"/users/@me", bytes.NewBuffer(body))
	if err != nil {
		log.WithFields(log.Fields{
			"body":  body,
			"req":   req,
			"error": err,
		}).Error("Failed to create @me request")
		http.Error(w, "Failed to retrieve user profile", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Authorization", token.Type()+" "+token.AccessToken)
	client := &http.Client{Timeout: (20 * time.Second)}
	resp, err := client.Do(req)
	if err != nil {
		log.WithFields(log.Fields{
			"error":  err,
			"client": client,
			"resp":   resp,
		}).Error("Failed to request @me data")
		http.Error(w, "Failed to retrieve user profile", http.StatusInternalServerError)
		return
	}

	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.WithFields(log.Fields{
			"error": err,
			"body":  resp.Body,
		}).Error("Failed to read data from HTTP response")
		http.Error(w, "Failed to retrieve user profile", http.StatusInternalServerError)
		return
	}

	user := discordgo.User{}
	err = json.Unmarshal(respBody, &user)
	if err != nil {
		log.WithFields(log.Fields{
			"data":  respBody,
			"error": err,
		}).Error("Failed to parse JSON payload from HTTP response")
		http.Error(w, "Failed to retrieve user profile", http.StatusInternalServerError)
		return
	}

	// Finally write some information to the session store
	session.Values["token"] = token.AccessToken
	session.Values["username"] = user.Username
	session.Values["tag"] = user.Discriminator
	delete(session.Values, "state")
	session.Save(r, w)

	// And redirect the user back to the dashboard
	http.Redirect(w, r, "/?key_to_success=1", http.StatusTemporaryRedirect)
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, "session")

	body, err := json.Marshal(map[string]interface{}{
		"username": session.Values["username"],
		"tag":      session.Values["tag"],
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func server() {
	server := http.NewServeMux()
	server.Handle("/", http.FileServer(http.Dir("static/dist")))
	server.HandleFunc("/me", handleMe)
	server.HandleFunc("/login", handleLogin)
	server.HandleFunc("/callback", handleCallback)

	// Only add this route if we have stats to push (e.g. redis connection)
	if es != nil {
		server.Handle("/events", es)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "14000"
	}

	log.WithFields(log.Fields{
		"port": port,
	}).Info("Starting HTTP Server")

	// If the requests log doesnt exist, make it
	if _, err := os.Stat("requests.log"); os.IsNotExist(err) {
		ioutil.WriteFile("requests.log", []byte{}, 0600)
	}

	// Open the log file in append mode
	logFile, err := os.OpenFile("requests.log", os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		log.WithFields(log.Fields{
			"err": err,
		}).Error("Failed to open requests log file")
		return
	}
	defer logFile.Close()

	// Actually start the server
	loggedRouter := handlers.LoggingHandler(logFile, server)
	http.ListenAndServe(":"+port, loggedRouter)
}

func broadcastLoop() {
	var id int = 0
	for {
		time.Sleep(time.Second * 1)

		es.SendEventMessage(string(NewCountUpdate().ToJSON()), "message", strconv.Itoa(id))
		id += 1
	}
}

func connectToRedis(connStr string) (err error) {
	log.WithFields(log.Fields{
		"host": connStr,
	}).Info("Connecting to redis")

	// Open the connection
	rcli = redis.NewClient(&redis.Options{Addr: connStr, DB: 0})

	// Attempt to ping it
	_, err = rcli.Ping().Result()

	if err != nil {
		log.WithFields(log.Fields{
			"host":  connStr,
			"error": err,
		}).Error("Failed to connect to redis")
		fmt.Printf("Failed to connect to redis: %s\n", err)
		return err
	}

	return nil
}

func main() {
	var (
		ClientID     = flag.String("i", "", "OAuth2 Client ID")
		ClientSecret = flag.String("s", "", "OAtuh2 Client Secret")
		Redis        = flag.String("r", "", "Redis Connection String")
		err          error
	)
	flag.Parse()

	if *Redis != "" {
		// First, open a redis connection we use for stats
		if connectToRedis(*Redis) != nil {
			return
		}

		// Now start the eventsource loop for client-side stat update
		es = eventsource.New(nil, nil)
		defer es.Close()
		go broadcastLoop()
	}

	// Load the HTML static page
	data, err := ioutil.ReadFile("templates/index.html")
	if err != nil {
		log.WithFields(log.Fields{
			"error": err,
		}).Error("Failed to open index.html")
		return
	}
	htmlIndexPage = string(data)

	// Create a cookie store
	store = sessions.NewCookieStore([]byte(*ClientSecret))

	// Setup the OAuth2 Configuration
	endpoint := oauth2.Endpoint{
		AuthURL:  apiBaseUrl + "/oauth2/authorize",
		TokenURL: apiBaseUrl + "/oauth2/token",
	}

	oauthConf = &oauth2.Config{
		ClientID:     *ClientID,
		ClientSecret: *ClientSecret,
		Scopes:       []string{"bot", "identify"},
		Endpoint:     endpoint,
		RedirectURL:  "https://airhornbot.com/callback",
	}

	server()
}
