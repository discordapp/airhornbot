import {Client} from "discord.js-light";
import {ComponentInteraction, DiscordCommandResponder} from "./DiscordInteraction";

export abstract class DiscordButton {

  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract executeInteraction(client: Client, interaction: ComponentInteraction, discordCommandResponder: DiscordCommandResponder): Promise<void>;

}
