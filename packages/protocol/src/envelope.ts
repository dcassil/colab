import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "./events.js";
import type { Identity, Participant } from "./identity.js";
import type { JsonValue } from "./json.js";
import type { PointerPosition } from "./pointer.js";
import type { ScopeId } from "./scope.js";

/**
 * A scoped interaction payload — a neutral, named action within a scope.
 *
 * `name` identifies the interaction kind (matched against the consumer's
 * interaction registry); `scopeId` locates it; `data` is an open,
 * structured-clone-safe bag. No host, layout, or domain meaning is implied.
 */
export interface InteractionPayload {
  /** The interaction kind, matched against the consumer's registry. */
  name: string;
  /** The scope the interaction targets. */
  scopeId: ScopeId;
  /** Optional structured-clone-safe interaction data. */
  data?: JsonValue;
}

/**
 * `MessageMap` — the single source of truth pairing each wire event name with
 * its payload type. Consumers use it to derive exhaustively-typed messages.
 *
 * Every {@link ColabEvent} and {@link ColabServerEvent} literal appears as a
 * key, so a `never`-guarded `switch` over `message.type` is provably
 * exhaustive at compile time.
 */
export interface MessageMap {
  [COLAB_EVENTS.POINTER]: PointerPosition;
  [COLAB_EVENTS.INTERACTION]: InteractionPayload;
  [COLAB_EVENTS.JOIN]: Identity;
  [COLAB_EVENTS.UPDATE]: Participant;
  [COLAB_EVENTS.LEAVE]: { id: string };

  [COLAB_SERVER_EVENTS.ROSTER]: { participants: Participant[] };
  [COLAB_SERVER_EVENTS.PARTICIPANT_JOINED]: Participant;
  [COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED]: Participant;
  [COLAB_SERVER_EVENTS.PARTICIPANT_LEFT]: { id: string };
  [COLAB_SERVER_EVENTS.POINTER]: PointerPosition;
  [COLAB_SERVER_EVENTS.INTERACTION]: InteractionPayload;
}

/** Every event name that has a payload entry in {@link MessageMap}. */
export type ColabMessageType = keyof MessageMap;

/**
 * `ColabMessage` — the envelope wrapping every value that crosses the wire.
 *
 * The generic form narrows `type` and `payload` *together* by looking the
 * payload up in {@link MessageMap}, so a `ColabMessage<'pointer'>` has a
 * `PointerPosition` payload and nothing else compiles. The default parameter
 * (`= ColabMessageType`) widens to the discriminated union of every message.
 *
 * `from` is always a bare id string (the sender's `Identity['id']`), never an
 * object. The envelope is composed only of structured-clone-safe fields.
 */
export type ColabMessage<T extends ColabMessageType = ColabMessageType> = {
  [K in T]: {
    /** The event discriminant. */
    type: K;
    /** The sender's identity id. */
    from: string;
    /** The payload, narrowed by `type` via {@link MessageMap}. */
    payload: MessageMap[K];
  };
}[T];

/**
 * Construct a well-typed {@link ColabMessage} for a single event `type`.
 *
 * A tiny convenience so callers get `type`/`payload` correlation enforced at
 * the call site without hand-writing the envelope object.
 */
export function createMessage<T extends ColabMessageType>(
  type: T,
  from: string,
  payload: MessageMap[T],
): ColabMessage<T> {
  return { type, from, payload };
}
