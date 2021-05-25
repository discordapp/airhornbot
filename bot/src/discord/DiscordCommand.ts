import {Client} from "discord.js-light";
import {CommandInteraction, DiscordCommandResponder} from "./DiscordInteraction";

export abstract class DiscordCommand {

  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract executeInteraction(client: Client, interaction: CommandInteraction, discordCommandResponder: DiscordCommandResponder): Promise<void>;

}
