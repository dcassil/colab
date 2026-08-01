/**
 * `reactionPing` — a CUSTOM interaction authored entirely in the example app.
 *
 * This is the extensibility proof: a brand-new collaborative behavior composed
 * purely on colab's public `defineInteraction` factory, with NO edit to any
 * colab core source. A participant "pings" a spot on the shared stage; every
 * tab renders a transient marker at that anchor-relative normalized point, then
 * it auto-expires (TTL carried in the payload; the render layer prunes on a
 * clock — `reduce` stays pure and clock-free so it is trivially unit-testable).
 *
 * SHAPE mirrors the reference `Cursor`/`EditLock` interactions exactly:
 *  - `reduce(state, message)` folds an inbound ping into `{ pings }` immutably,
 *    deduping by ping id (a re-send replaces rather than duplicates).
 *  - `toMessage(event)` serializes a local trigger into an outbound message.
 *  - `selectors.active(now)` returns only the not-yet-expired pings.
 *
 * API-ERGONOMICS GAP (filed to I4/I5): colab-ui does NOT re-export the wire
 * helpers a custom interaction needs to build/read a message — `ColabMessage`,
 * `createMessage`, `COLAB_EVENTS`, or the branded `ScopeId`/`asScopeId`. The
 * `reduce`/`toMessage` MESSAGE types are recoverable by inference from
 * `defineInteraction`'s generics (so authoring still type-checks), and the
 * outbound envelope is built as a plain literal, but a first-class public
 * "author a message" surface would make this far more ergonomic.
 */
import { defineInteraction } from "colab-ui";
import type { EditLockState, InteractionRegistry } from "colab-ui";

/**
 * The branded `ScopeId`, recovered from a PUBLIC export without importing
 * colab-protocol or any internal: `EditLockState` is `Record<ScopeId, …>`, so
 * its key type IS `ScopeId`. (colab-ui does not re-export `ScopeId`/`asScopeId`
 * directly — see the gap note above.)
 */
type ScopeId = keyof EditLockState;

/** The interaction kind discriminator (matched against `payload.name`). */
export const REACTION_PING_TYPE = "reaction-ping";

/** The stage-global scope every ping targets. */
const PING_SCOPE = "reaction-ping" as ScopeId;

/** One transient ping marker on the stage. */
export interface Ping {
  /** Unique id for this ping (dedup + React key). */
  id: string;
  /** Sender participant id. */
  from: string;
  /** Anchor-relative normalized x (0–1). */
  x: number;
  /** Anchor-relative normalized y (0–1). */
  y: number;
  /** Absolute epoch-ms after which the ping should disappear. */
  expiresAt: number;
}

/** The local trigger event a component hands to `send`. */
export interface PingEvent {
  id: string;
  x: number;
  y: number;
  expiresAt: number;
}

/** Reaction-ping interaction state: the currently-known pings. */
export interface PingState {
  pings: readonly Ping[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extract a well-formed ping from an inbound message, or null. */
function readPing(payload: unknown, from: string): Ping | null {
  if (!isRecord(payload) || payload.name !== REACTION_PING_TYPE) return null;
  const data = payload.data;
  if (!isRecord(data)) return null;
  const { id, x, y, expiresAt } = data;
  if (
    typeof id !== "string" ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof expiresAt !== "number"
  ) {
    return null;
  }
  return { id, from, x, y, expiresAt };
}

/** Build the reaction-ping descriptor and register it in `registry`. */
export function createReactionPing(registry?: InteractionRegistry) {
  return defineInteraction<
    PingState,
    PingEvent,
    { active: (state: PingState) => (now: number) => readonly Ping[] }
  >(
    {
      type: REACTION_PING_TYPE,
      initialState: { pings: [] },
      reduce: (state, message): PingState => {
        const ping = readPing(message.payload, message.from);
        if (ping === null) return state;
        const others = state.pings.filter((existing) => existing.id !== ping.id);
        return { pings: [...others, ping] };
      },
      toMessage: (event) => ({
        type: "interaction",
        from: "",
        payload: {
          name: REACTION_PING_TYPE,
          scopeId: PING_SCOPE,
          data: {
            id: event.id,
            x: event.x,
            y: event.y,
            expiresAt: event.expiresAt,
          },
        },
      }),
      selectors: {
        active: (state) => (now) =>
          state.pings.filter((ping) => ping.expiresAt > now),
      },
    },
    registry,
  );
}

/**
 * The custom interaction instance, registered at module load in the default
 * registry. Passed to `<ColabProvider interactions>` and read via
 * `useInteraction(reactionPing)`.
 */
export const reactionPing = createReactionPing();
