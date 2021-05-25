import {Client} from "discord.js-light";
import {config} from "./utils/Configuration";
import {DiscordListener} from "./discord/DiscordListener";
import {ReadyListener} from "./discord/listeners/ReadyListener";
import {InteractionCreateListener} from "./discord/listeners/InteractionCreateListener";
import {DiscordCommand} from "./discord/DiscordCommand";
import {AirhornCommand} from "./discord/commands/AirhornCommand";
import {AirhornMetaCommand} from "./discord/commands/AirhornMetaCommand";
import {DiscordButton} from "./discord/DiscordButton";
import {PlayButton} from "./discord/buttions/PlayButton";

export class AirhornBot {

  public readonly client: Client;
  public readonly commands: Map<string, DiscordCommand>;
  public readonly buttons: Map<string, DiscordButton>;

  constructor() {
    this.client = new Client({
      ws: {
        intents: ["GUILDS", "GUILD_VOICE_STATES"]
      },
      shards: "auto",
      presence: {
        status: "online",
        activity: {
          type: "PLAYING",
          name: "airhorn.solutions"
        }
      },
      cacheOverwrites: true,
      cacheRoles: true
    });
    this.commands = new Map<string, DiscordCommand>();
    this.buttons = new Map<string, DiscordButton>();
    // Register the listeners
    this.registerListener(new InteractionCreateListener());
    this.registerListener(new ReadyListener());
    // Register the commands
    const soundKeys = Object.keys(config.sounds);
    for (let i = 0; i < soundKeys.length; i++) {
      this.registerCommand(new AirhornCommand(soundKeys[i]));
    }
    this.registerCommand(new AirhornMetaCommand());
    // Register the buttons
    this.registerButton(new PlayButton());
  }

  async start(): Promise<void> {
    await this.client.login(config.discord.token);
  }

  registerListener(discordListener: DiscordListener): void {
    discordListener.registerListener(this);
  }

  registerCommand(discordCommand: DiscordCommand): void {
    this.commands.set(discordCommand.name, discordCommand);
  }

  registerButton(discordButton: DiscordButton): void {
    this.buttons.set(discordButton.name, discordButton);
  }
}

(async () => {
  const airhornBot = new AirhornBot();
  try {
    await airhornBot.start();
  } catch (e) {
    console.error(e);
  }
})();
