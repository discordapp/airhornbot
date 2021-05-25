import {DiscordListener} from "../DiscordListener";
import {DiscordCommand} from "../DiscordCommand";
import {AirhornBot} from "../../bot";
import {
  DiscordCommandResponder, Interaction,
  InteractionComponentCustomIdData,
  InteractionDataComponent
} from "../DiscordInteraction";
import {DiscordButton} from "../DiscordButton";

export class InteractionCreateListener extends DiscordListener {

  registerListener(airhornBot: AirhornBot): void {
    airhornBot.client.ws.on("INTERACTION_CREATE" as never, async (interaction: Interaction) => {
      try {
        if (interaction.type === 2) { // Commands
          const commandName = interaction.data.name.toLowerCase();
          // Check to make sure the command exists
          if (!airhornBot.commands.has(commandName)) {
            return new DiscordCommandResponder(interaction.id, interaction.token).sendBackMessage("The command requested was not understood.", false);
          }
          // Execute the command
          await (airhornBot.commands.get(commandName) as DiscordCommand).executeInteraction(airhornBot.client, interaction, new DiscordCommandResponder(interaction.id, interaction.token));
        } else if (interaction.type === 3) { // Components
          const interactionComponentData = (interaction.data as InteractionDataComponent);
          let interactionCustomIdParsed;
          try {
            interactionCustomIdParsed = JSON.parse(interactionComponentData.custom_id) as InteractionComponentCustomIdData;
          } catch (e) {
            // Ignore invalid JSON
          }
          if (interactionCustomIdParsed) {
            if (interactionComponentData.component_type === 2) { // Button
              if (!airhornBot.buttons.has(interactionCustomIdParsed.name)) {
                return new DiscordCommandResponder(interaction.id, interaction.token).sendBackMessage("The button requested was not understood.", false);
              }
              // Execute the button
              await (airhornBot.buttons.get(interactionCustomIdParsed.name) as DiscordButton).executeInteraction(airhornBot.client, interaction, new DiscordCommandResponder(interaction.id, interaction.token));
            } else { // Unknown
              return new DiscordCommandResponder(interaction.id, interaction.token).sendBackMessage("The component type requested was not understood.", false);
            }
          } else {
            return new DiscordCommandResponder(interaction.id, interaction.token).sendBackMessage("The component requested was not understood.", false);
          }
        }
      } catch (e) {
        console.error(e);
        return new DiscordCommandResponder(interaction.id, interaction.token).sendBackMessage("The bot encountered an error when running the interaction.", false);
      }
    });
  }
}
