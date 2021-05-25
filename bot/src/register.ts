import fetch from "node-fetch";
import {config} from "./utils/Configuration";

const specifiedCommandArgs = process.argv.slice(2);

const mode = specifiedCommandArgs[0] || "set";
const guildId = specifiedCommandArgs[1] || undefined;

(async () => {
  if (!["set", "clear"].includes(mode.toLowerCase())) {
    return console.log("The mode specified must be one of 'set' or 'clear'");
  }
  if (guildId && !String(guildId).match(/^\d+$/g)) {
    return console.log("The guild id must be valid.");
  }

  const guildUrlPart = guildId ? "/guilds/" + String(guildId) : "";

  // Clear all of the commands if the mode is clear and then exit
  if (mode.toLowerCase() === "clear") {
    const response = await fetch("https://discord.com/api/v8/applications/" + config.discord.applicationId + guildUrlPart + "/commands", {
      method: "put",
      headers: {
        "authorization": "Bot " + config.discord.token,
        "content-type": "application/json"
      },
      body: JSON.stringify([])
    });
    return console.log(await response.json());
  }

  // sound commands
  const commands: unknown[] = Object.entries(config.sounds).map((sound: [string, {
    name: string,
    description: string,
    emoji: string | undefined,
    variants: {
      [key: string]: string
    }
  }]) => {
    return {
      name: sound[0],
      description: sound[1].name + ": " + sound[1].description,
      options: sound[0] !== "airhorn" ? [
        {
          name: "variant",
          description: "Spice it up with some different sounds!",
          required: false,
          type: 3,
          choices: Object.entries(sound[1].variants).map((soundVariant: [string, string]) => {
            return {
              name: soundVariant[0],
              value: soundVariant[0].toLowerCase()
            };
          })
        }
      ] : undefined
    };
  });

  // random command (this shouldn't be added in the config)
  commands.push({
    name: "random",
    description: "Play a random sound.",
  });

  // airhornmeta command
  commands.push({
    name: "airhornmeta",
    description: "Useful airhorn-related commands.",
    type: 1,
    options: [
      {
        name: "stats",
        description: "See the numbers!",
        type: 1,
        options: []
      },
      {
        name: "invite",
        description: "Instructions for inviting the bot.",
        type: 1,
        options: []
      }
    ]
  });

  const response = await fetch("https://discord.com/api/v8/applications/" + config.discord.applicationId + guildUrlPart + "/commands", {
    method: "put",
    headers: {
      "authorization": "Bot " + config.discord.token,
      "content-type": "application/json"
    },
    body: JSON.stringify(commands)
  });

  console.log(await response.json());
})();
