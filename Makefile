BOT_DIR=cmd/airhornbot
WEB_DIR=cmd/airhornweb
BOT_BINARY=${GOPATH}/bin/airhornbot
WEB_BINARY=${GOPATH}/bin/airhornweb

JS_FILES = $(shell find static/src/ -type f -name '*.js')

default: all

.PHONY: all
all: bot web npm gulp

bot: cmd/airhornbot/bot.go
	cd ${BOT_DIR} && go get && \
    go build -o ${BOT_BINARY} bot.go

web: cmd/airhornweb/web.go static
	cd ${WEB_DIR} && go get && \
	go build -o ${WEB_BINARY} web.go

npm: static/package.json
	cd static && npm install .

gulp: $(JS_FILES)
	cd static && gulp dist

.PHONY: static
static: npm gulp

.PHONY: clean
clean:
	rm -rf ${BOT_BINARY} ${WEB_BINARY} static/dist/ cmd/airhorn*/dump.rdb
