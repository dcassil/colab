export { allowAll, type AuthToken, type VerifyIdentity } from "./auth.js";
export {
  CLIENT_MESSAGE_EVENTS,
  isRelayMessage,
  toServerRelayEvent,
  type ClientMessage,
  type ClientMessageEvent,
  type RelayClientEvent,
  type RelayMessage,
} from "./protocol-adapter.js";
export {
  RoomInteractionStore,
  toClearPayload,
  toLockPayload,
  type ActiveInteraction,
} from "./interaction-state.js";
export { attachColabRelay, type RelayOptions } from "./relay.js";
export { RoomRosterStore, toParticipant } from "./roster.js";
export {
  createColabServer,
  type ColabServer,
  type ColabSocketServer,
  type CorsConfig,
  type CreateColabServerOptions,
} from "./server.js";
export type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
} from "./socket-events.js";
