import {DiscordCommand} from "../DiscordCommand";
import {Client} from "discord.js-light";
import {config} from "../../utils/Configuration";
import {
  CommandInteraction,
  DiscordCommandResponder,
  InteractionCommandOption
} from "../DiscordInteraction";
import {enqueueSound, getSound} from "../../utils/AirhornAudio";
import {trackPlay} from "../../utils/StatsTracker";

export class AirhornCommand extends DiscordCommand {

  constructor(name: string) {
    super(name);
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
    let soundVariant: string | undefined;
    if (interaction.data.options) {
      interaction.data.options.forEach((option: InteractionCommandOption) => {
        if (option.name === "variant") {
          soundVariant = String(option.value).toLowerCase();
        }
      });
    }
    const voiceChannel = guildMember.voice.channel;
    if (!voiceChannel) {
      return discordCommandResponder.sendBackMessage("You need to be in a voice channel.", false);
    }
    let fetchedVoiceChannel;
    try {
      fetchedVoiceChannel = await client.channels.fetch(voiceChannel.id,{
        withOverwrites: true
      });
    } catch (e) {
      return discordCommandResponder.sendBackMessage("The bot could not connect to the voice channel.", false);
    }
    if (!fetchedVoiceChannel) {
      return discordCommandResponder.sendBackMessage("You need to be in a voice channel.", false);
    }
    if (!botGuildMember.permissionsIn(fetchedVoiceChannel).has("CONNECT")) {
      return discordCommandResponder.sendBackMessage("The bot could not connect to the voice channel.", false);
    }
    const sound = getSound(this.name, soundVariant);
    if (!sound) {
      return discordCommandResponder.sendBackMessage("The sound specified was not found.", false);
    }
    // Don't await this, play the sound ASAP

    discordCommandResponder.sendBackMessage("Dispatching sound...", true, [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Replay",
            custom_id: JSON.stringify({
              name: "play",
              soundName: sound.sound,
              soundVariant: sound.variant
            }),
            emoji: config.sounds[this.name].emoji ? {
              id: String(config.sounds[this.name].emoji)
            } : {
              id: String(config.discord.emojis.airhorn)
            }
          }
        ]
      }
    ]);
    trackPlay(guild.id, voiceChannel.id, guildMember.id, sound.sound);
    // Dispatch the sound
    enqueueSound(voiceChannel, sound.variantFile);
  }
}
