import {DiscordCommand} from "../DiscordCommand";
import {Client} from "discord.js-light";
import {getCountForKey, sumOfKeys} from "../../utils/RedisUtils";
import {config} from "../../utils/Configuration";
import {CommandInteraction, DiscordCommandResponder} from "../DiscordInteraction";

export class AirhornMetaCommand extends DiscordCommand {

  constructor() {
    super("airhornmeta");
  }

  async executeInteraction(client: Client, interaction: CommandInteraction, discordCommandResponder: DiscordCommandResponder): Promise<void> {
    if (!interaction.data.options) {
      // Fail if no options
      return;
    }
    const subcommandName = interaction.data.options[0].name;
    switch (subcommandName.toLowerCase()) {
    case "invite": {
      // Send back the invite
      return discordCommandResponder.sendBackMessage("Add me to your server: <https://discord.com/api/oauth2/authorize?client_id=" + config.discord.applicationId + "&permissions=3146752&scope=applications.commands%20bot>", false);
    }
    case "stats": {
      const lines = [
        "**Statistics**"
      ];
      // Global count
      const totalGlobalCount = await getCountForKey(config.redis.prefix + ":total");
      lines.push("Global: " + totalGlobalCount.toLocaleString("en-US"));
      // Guild count (if run in guild)
      if (interaction.member) {
        const totalGuildCount = await sumOfKeys(config.redis.prefix + ":counts:guild:" + interaction.guild_id + ":sound:*");
        lines.push("Guild: " + totalGuildCount.toLocaleString("en-US"));
      }
      // Self count (if the user id is found)
      const userId = interaction.member ? interaction.member.user.id : (interaction.user ? interaction.user.id : undefined);
      if (userId) {
        const totalSelfCount = await sumOfKeys(config.redis.prefix + ":counts:user:" + userId + ":sound:*");
        lines.push("You: " + totalSelfCount.toLocaleString("en-US"));
      }
      // Send back the stats
      return discordCommandResponder.sendBackMessage(lines.join("\n"), true);
    }
    }
  }
}
