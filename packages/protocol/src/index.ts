/**
 * colab-protocol — the shared, framework-free wire contract.
 *
 * Single source of truth for every value that crosses the `colab` wire:
 * the {@link ColabMessage} envelope + {@link MessageMap}, the client/server
 * event constant sets, the neutral domain types ({@link Identity},
 * {@link Participant}, {@link PointerPosition}), the opaque branded
 * {@link ScopeId} with helpers, and the {@link JsonValue} space.
 *
 * This package is the leaf: it has zero third-party runtime dependencies and
 * zero DOM/framework imports, and it carries no host, embedding, layout, or
 * positional vocabulary. Every exported type is structured-clone-safe by construction.
 */

export type { JsonValue, JsonObject } from "./json.js";

export type { ScopeId } from "./scope.js";
export { asScopeId, composeScopeId, isScopeId } from "./scope.js";

export type { Identity, Participant } from "./identity.js";

export type { PointerPosition } from "./pointer.js";

export { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "./events.js";
export type { ColabEvent, ColabServerEvent } from "./events.js";

export type {
  ColabMessage,
  ColabMessageType,
  MessageMap,
  InteractionPayload,
} from "./envelope.js";
export { createMessage } from "./envelope.js";
