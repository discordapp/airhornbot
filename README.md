# Airhorn Bot
Airhorn is an example implementation of the [Discord API](https://discordapp.com/developers/docs/intro). Airhorn bot utilizes the [discordgo](https://github.com/bwmarrin/discordgo) library, a free and open source library. Airhorn Bot requires Go 1.4 or higher.

## Usage
Airhorn Bot has two components, a bot client that handles the playing of loyal airhorns, and a web server that implements OAuth2 and stats. Once added to your server, airhorn bot can be summoned by running `!airhorn`.

### INSTALLATION

#### Prerequisites

 - [Go 1.4 or higher](https://golang.org)
 - [Redis Server](http://redis.io)

Once you have completed your Go installation make sure you have these variables on your system:
```
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
```
Then, get the source code and install with
```
go get github.com/hammerandchisel/airhornbot
cd $GOPATH/src/github.com/hammerandchisel/airhornbot
make
```

### Discord API
You will need to make a new application on the [Discord API](https://discordapp.com/developers/applications/me) with a Redirect URI of 
```
https://airhornbot.com/callback
```
Then, go into your newly created application and click the **Create a Bot User** button and accept the prompt.

### Running the Web Server
***NOTE:*** *The variables used in this command come from your application under the **APP DETAILS** section.*
```
airhornweb -r "localhost:6379" -i MY_APPLICATION_ID -s 'MY_APPLICATION_SECRET"
```
Once the web server is running you can visit it at `http://localhost:14000` to add the bot to your desired server or to view the bot's stats.

### Running the Bot
***NOTE:*** *The variables used in this command come from your application under the **APP BOT USER** section. Also,  you can find your owner ID by running `\@YOUR_USERNAME` in Discord.*

After adding / permitting the bot on your Discord server you can then run the bot to process requests with
```
bot -r "localhost:6379" -t "MY_BOT_ACCOUNT_TOKEN" -o OWNER_ID
```
This is what will process the commands, it must be running for the bot to respond in Discord.

***NOTE:*** *if your bot is able to join channels but no audio is being sent you may be invoking this command in the wrong directory. Make sure to be in the `$GOPATH/src/github.com/hammerandchisel/airhornbot` directory.*

## Thanks
Thanks to the awesome (one might describe them as smart... loyal... appreciative...) [iopred](https://github.com/iopred) and [bwmarrin](https://github.com/bwmarrin/discordgo) for helping code review the initial release.

