# airhornbot

A Node.js implementation of Airhorn Bot.

# Setup

Prerequisites:
- Redis Server
- Yarn

## Website

Build the website for usage.

Example commands:
```
cd website
yarn install
yarn run build
```

## Bot

Build the bot and webserver process.

Make sure to update/create `config.json`!

Example commands:
```
cd bot
yarn install
yarn run build
```

To register the slash commands:
```
cd bot
yarn run register-commands
```

To run the bot:
```
cd bot
yarn run bot
```

To run the web server:
```
cd bot
yarn run web
```
