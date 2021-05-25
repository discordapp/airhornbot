import {readFileSync} from "fs";
import path from "path";
import {Readable} from "stream";
import {VoiceChannel, VoiceConnection} from "discord.js";
import {config} from "./Configuration";

const audioBuffers: {
  [key: string]: Buffer
} = {};

type GuildQueueItem = {
  voiceChannel: VoiceChannel,
  soundFileName: string
};

const guildQueues = new Map<string, GuildQueueItem[]>();

export const soundFiles = new Map<string, Map<string, string>>();
export const soundVariants = new Map<string, string[]>();

const soundsKeys = Object.keys(config.sounds);
for (const soundKeysIndex in soundsKeys) {
  const soundKey = soundsKeys[soundKeysIndex];
  soundFiles.set(soundKey, new Map<string, string>());
  soundVariants.set(soundKey, []);
  const variants = config.sounds[soundKey].variants;
  const variantsKeys = Object.keys(variants);
  for (const variantKeysIndex in variantsKeys) {
    const variantKey = variantsKeys[variantKeysIndex];
    const variantFileName = variants[variantKey];
    audioBuffers[soundKey + "/" + variantFileName] = readFileSync(path.join(__dirname, "..", "..", "sounds", soundKey, variantFileName));
    soundFiles.get(soundKey)?.set(variantKey.toLowerCase(), soundKey + "/" + variantFileName);
    soundVariants.get(soundKey)?.push(variantKey);
  }
}

function getGuildQueue(guildId: string): GuildQueueItem[] {
  return guildQueues.get(guildId) || [];
}

export function getSound(inputSoundName: string | null, inputSoundVariant?: string): [string, string, string] | undefined {
  // Choose sound
  const soundsToPickFrom = (inputSoundName !== null && inputSoundName !== "random") ? [inputSoundName] : [...soundFiles.keys()];
  const chosenSound = soundsToPickFrom[Math.floor(Math.random() * soundsToPickFrom.length)];
  const soundVariants = soundFiles.get(chosenSound);
  if (!soundVariants) {
    return undefined;
  }
  // Choose variant
  const variantsToPickFrom = inputSoundVariant ? [inputSoundVariant] : [...soundVariants.keys()];
  const chosenVariant = variantsToPickFrom[Math.floor(Math.random() * variantsToPickFrom.length)];
  const soundVariantFile = soundVariants.get(chosenVariant);
  if (!soundVariantFile) {
    return undefined;
  }
  return [chosenSound, chosenVariant, soundVariantFile];
}

export async function enqueueSound(voiceChannel: VoiceChannel, soundFileName: string): Promise<void> {
  // Make sure the server queue exists
  if (!guildQueues.has(voiceChannel.guild.id)) {
    guildQueues.set(voiceChannel.guild.id, []);
  }
  const guildQueue = getGuildQueue(voiceChannel.guild.id);
  // Add the sound to the queue if the queue is less than the max
  if (guildQueue.length < config.settings.maxQueueSize) {
    guildQueue.push({
      voiceChannel,
      soundFileName
    });
  }
  if (guildQueue.length < 2) {
    playSound(voiceChannel.guild.id);
  }
}

async function playSound(guildId: string): Promise<void> {
  let voiceChannel: VoiceChannel | undefined;
  try {
    // Loop through the queue
    let connection: VoiceConnection | undefined;
    const guildQueue = getGuildQueue(guildId);
    while (guildQueue.length > 0) {
      const itemFromQueue = guildQueue[0];
      if (!connection || connection.channel.id !== itemFromQueue.voiceChannel.id) {
        voiceChannel = itemFromQueue.voiceChannel;
        connection = await voiceChannel.join();
      }
      // Play the sound from the queue
      const dispatcher = connection.play(Readable.from(audioBuffers[itemFromQueue.soundFileName]), {
        type: "ogg/opus",
        volume: false
      });
      // Wait until the sound finishes
      await new Promise<void>(resolve => {
        // The handler for when the dispatcher finishes
        const finishHandler = () => {
          dispatcher.off("finish", finishHandler);
          if (connection) {
            connection.off("disconnect", finishHandler);
            connection.off("error", errorHandler);
          }
          resolve();
        };
        // The handler for connection errors
        const errorHandler = (e: Error) => {
          console.log(e);
          if (voiceChannel) {
            voiceChannel.leave();
          }
          dispatcher.off("finish", finishHandler);
          if (connection) {
            connection.off("disconnect", finishHandler);
            connection.off("error", errorHandler);
          }
          connection = undefined;
          resolve();
        };
        // On sound finish
        dispatcher.on("finish", finishHandler);
        if (connection) {
          connection.on("disconnect", finishHandler);
          connection.on("error", (e: Error) => {
            console.log(e);
            if (voiceChannel) {
              voiceChannel.leave();
            }
            connection = undefined;
            resolve();
          });
        }
      });
      guildQueue.shift();
    }
    // Remove the queue since we are done and leave the voice channel
    guildQueues.delete(guildId);
    if (voiceChannel) {
      voiceChannel.leave();
    }
  } catch (e) {
    console.error(e);
    guildQueues.delete(guildId);
    if (voiceChannel) {
      voiceChannel.leave();
    }
  }
}
