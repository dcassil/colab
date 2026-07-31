/**
 * Event-name constants for the `colab` wire.
 *
 * Two disjoint constant sets mirror the client/server split (the neutral
 * re-derivation of the source's presence event split, with all CMS naming
 * removed):
 *
 *   - {@link COLAB_EVENTS}        — client → bus/server message types.
 *   - {@link COLAB_SERVER_EVENTS} — server → client lifecycle events.
 *
 * Both are declared `as const` so their values are literal-typed, and each
 * yields a derived string-literal union (`ColabEvent` / `ColabServerEvent`).
 * These literals are the discriminants of the message map in `envelope.ts`.
 */

/** Client → bus/server message types. */
export const COLAB_EVENTS = {
  /** A participant moved their pointer. */
  POINTER: "pointer",
  /** A participant performed a scoped interaction. */
  INTERACTION: "interaction",
  /** A client announces it is joining a room. */
  JOIN: "join",
  /** A client updates its own presence metadata. */
  UPDATE: "update",
  /** A client announces it is leaving a room. */
  LEAVE: "leave",
} as const;

/** The union of all client-originated event names. */
export type ColabEvent = (typeof COLAB_EVENTS)[keyof typeof COLAB_EVENTS];

/** Server → client lifecycle events. */
export const COLAB_SERVER_EVENTS = {
  /** The full current roster, sent on join / resync. */
  ROSTER: "roster",
  /** A participant joined the room. */
  PARTICIPANT_JOINED: "participant_joined",
  /** A participant's presence metadata changed. */
  PARTICIPANT_UPDATED: "participant_updated",
  /** A participant left the room. */
  PARTICIPANT_LEFT: "participant_left",
  /** A pointer position broadcast originating from a peer. */
  POINTER: "server_pointer",
  /** A scoped interaction broadcast originating from a peer. */
  INTERACTION: "server_interaction",
} as const;

/** The union of all server-originated event names. */
export type ColabServerEvent =
  (typeof COLAB_SERVER_EVENTS)[keyof typeof COLAB_SERVER_EVENTS];
