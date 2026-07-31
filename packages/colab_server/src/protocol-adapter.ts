import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  type ColabEvent,
  type ColabMessage,
  type ColabServerEvent,
} from "colab-protocol";

const RELAY_EVENT_MAP = {
  [COLAB_EVENTS.POINTER]: COLAB_SERVER_EVENTS.POINTER,
  [COLAB_EVENTS.INTERACTION]: COLAB_SERVER_EVENTS.INTERACTION,
} as const satisfies Partial<Record<ColabEvent, ColabServerEvent>>;

export const CLIENT_MESSAGE_EVENTS = [
  COLAB_EVENTS.POINTER,
  COLAB_EVENTS.INTERACTION,
  COLAB_EVENTS.UPDATE,
  COLAB_EVENTS.LEAVE,
] as const;

export type ClientMessageEvent = (typeof CLIENT_MESSAGE_EVENTS)[number];
export type RelayClientEvent = keyof typeof RELAY_EVENT_MAP;

export type RelayMessage = ColabMessage<RelayClientEvent>;
export type ClientMessage = ColabMessage<ClientMessageEvent>;

export function isRelayMessage(message: ClientMessage): message is RelayMessage {
  return message.type in RELAY_EVENT_MAP;
}

export function toServerRelayEvent(type: RelayClientEvent): ColabServerEvent {
  return RELAY_EVENT_MAP[type];
}
