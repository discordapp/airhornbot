import fetch, {Response} from "node-fetch";

export type InteractionCommandOption = {
  name: string;
  value: string | number;
};

export type InteractionDataCommand = {
  name: string;
  options?: InteractionCommandOption[];
};

export type InteractionDataComponent = {
  custom_id: string;
  component_type: number;
};

export type Interaction = CommandInteraction | ComponentInteraction;

export interface CommandInteraction {
  type: 2;
  id: string;
  token: string;
  data: InteractionDataCommand;
  guild_id?: string;
  member?: {
    user: {
      id: string;
    };
  };
  user?: {
    id: string;
  };
}

export interface ComponentInteraction {
  type: 3;
  id: string;
  token: string;
  data: InteractionDataComponent;
  guild_id?: string;
  member?: {
    user: {
      id: string;
    };
  };
  user?: {
    id: string;
  };
}

export enum InteractionResponseType {
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6
}

export type InteractionResponseData = {
  type: InteractionResponseType;
  data?: {
    content: string;
    flags?: number;
    components?: DiscordComponent[];
  };
};

export type DiscordComponent = {
  type: number;
  components?: DiscordComponent[];
  style?: number;
  label?: string;
  custom_id?: string;
  disabled?: boolean;
  emoji?: {
    id: string;
    animated?: boolean;
  } | undefined;
};

// Custom type for the interaction custom_id data
export type InteractionComponentCustomIdData = {
  name: string;
} & { [key: string]: string | number | null | undefined };

// Convert buttons array into a 5x5 grid of components
export function convertButtonsIntoButtonGrid(buttonComponents: DiscordComponent[]): DiscordComponent[] {
  const gridComponents: DiscordComponent[] = [];
  let i = 0;
  for (let row = 0; row < 5; row++) {
    if ((row * 5) > (buttonComponents.length - 1)) {
      break;
    }
    gridComponents.push({
      type: 1,
      components: []
    });
    for (let column = 0; column < 5; column++) {
      if ((row * 5) + column < buttonComponents.length) {
        gridComponents[row].components?.push(buttonComponents[i]);
        i++;
      }
    }
  }
  return gridComponents;
}

export class DiscordCommandResponder {

  public readonly interactionId: string;
  public readonly interactionToken: string;

  constructor(interactionId: string, interactionToken: string) {
    this.interactionId = interactionId;
    this.interactionToken = interactionToken;
  }

  async sendBackMessage(text: string, showForAll: boolean, components?: DiscordComponent[]): Promise<void> {
    await DiscordCommandResponder.sendInteractionCallback(this.interactionId, this.interactionToken, {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: text,
        flags: showForAll ? undefined : 1 << 6,
        components
      }
    });
  }

  async sendBackDeferredUpdateMessage(): Promise<void> {
    await DiscordCommandResponder.sendInteractionCallback(this.interactionId, this.interactionToken, {
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
    });
  }

  static async sendInteractionCallback(interactionId: string, interactionToken: string, data: InteractionResponseData): Promise<Response> {
    return fetch("https://discord.com/api/v8/interactions/" + interactionId + "/" + interactionToken + "/callback", {
      method: "post",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(data)
    });
  }
}
