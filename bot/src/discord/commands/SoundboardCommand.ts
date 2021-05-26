import {DiscordCommand} from "../DiscordCommand";
import {Client} from "discord.js-light";
import {config} from "../../utils/Configuration";
import {
  CommandInteraction,
  convertButtonsIntoButtonGrid,
  DiscordCommandResponder, DiscordComponent,
  InteractionCommandOption
} from "../DiscordInteraction";
import {soundVariants} from "../../utils/AirhornAudio";

export class SoundboardCommand extends DiscordCommand {

  constructor() {
    super("soundboard");
  }

  async executeInteraction(client: Client, interaction: CommandInteraction, discordCommandResponder: DiscordCommandResponder): Promise<void> {
    // Make sure they are in a guild
    if (!interaction.member || !interaction.guild_id) {
      return discordCommandResponder.sendBackMessage("You can't trigger the bot in a direct message.", false);
    }
    if (!client.guilds.cache.has(interaction.guild_id)) {
      return discordCommandResponder.sendBackMessage("The bot must be in the guild too.", false);
    }
    // Get the guild for the command
    const guild = await client.guilds.fetch(interaction.guild_id);
    // Get the member from the command
    const guildMember = await guild.members.fetch(interaction.member.user.id);
    if (!guildMember) {
      return discordCommandResponder.sendBackMessage("You were not found in the guild.", false);
    }
    const botGuildMember = await guild.members.fetch(config.discord.botId);
    if (!botGuildMember) {
      return discordCommandResponder.sendBackMessage("The bot was not found in the guild.", false);
    }
    // Run the command
    let sound: string | undefined;
    if (interaction.data.options) {
      interaction.data.options.forEach((option: InteractionCommandOption) => {
        if (option.name === "sound") {
          sound = String(option.value).toLowerCase();
        }
      });
    }
    if (!sound || !soundVariants.has(sound)) {
      return discordCommandResponder.sendBackMessage("The sound specified was not found.", false);
    }
    const buttons: DiscordComponent[] = [];
    const soundVariantNames = soundVariants.get(sound) || [];
    for (let i = 0; i < soundVariantNames.length; i++) {
      buttons.push({
        type: 2,
        style: 1,
        label: soundVariantNames[i],
        custom_id: JSON.stringify({
          name: "play",
          soundName: sound,
          soundVariant: soundVariantNames[i].toLowerCase()
        })
      });
    }
    buttons.push({
      type: 2,
      style: 3,
      label: "Random",
      custom_id: JSON.stringify({
        name: "play",
        soundName: sound
      })
    });
    const fullComponents = convertButtonsIntoButtonGrid(buttons);
    return discordCommandResponder.sendBackMessage("Here's the menu for that sound.", true, fullComponents);
  }
}
