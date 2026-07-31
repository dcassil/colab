import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "../events.js";
import { createMessage } from "../envelope.js";
import type { ColabMessage } from "../envelope.js";
import type { Identity, Participant } from "../identity.js";
import type { PointerPosition } from "../pointer.js";
import { asScopeId } from "../scope.js";

/**
 * Deterministic one-sample-per-wire-shape fixtures for the `protocol` surface.
 * Shared by the serialization suite (T7) and the integration test (T9).
 *
 * TRACEABILITY CHECKLIST — every exported wire value shape appears here:
 *  Identity, Participant, PointerPosition (with + without scopeId),
 *  nested-JsonValue `extra`, and one ColabMessage per COLAB_EVENTS and
 *  per COLAB_SERVER_EVENTS type.
 */

export const identity: Identity = {
  id: "u1",
  name: "Ada",
  color: "#ff00ff",
  extra: { role: "editor", flags: [true, false], nested: { n: 1, s: null } },
};

export const participant: Participant = {
  id: "u2",
  name: "Grace",
  color: "#00ffff",
};

export const pointerWithScope: PointerPosition = {
  x: 0.25,
  y: 0.75,
  scopeId: asScopeId("scope-a"),
};

export const pointerWithoutScope: PointerPosition = { x: 0.5, y: 0.5 };

/** One message per client event. */
export const clientMessages = {
  pointer: createMessage(COLAB_EVENTS.POINTER, "u1", pointerWithScope),
  interaction: createMessage(COLAB_EVENTS.INTERACTION, "u1", {
    name: "cursor",
    scopeId: asScopeId("scope-a"),
    data: { note: "hi", coords: [1, 2, 3] },
  }),
  join: createMessage(COLAB_EVENTS.JOIN, "u1", identity),
  update: createMessage(COLAB_EVENTS.UPDATE, "u2", participant),
  leave: createMessage(COLAB_EVENTS.LEAVE, "u2", { id: "u2" }),
} as const;

/** One message per server event. */
export const serverMessages = {
  roster: createMessage(COLAB_SERVER_EVENTS.ROSTER, "server", {
    participants: [participant, { ...identity }],
  }),
  joined: createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, "server", participant),
  updated: createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED, "server", participant),
  left: createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, "server", { id: "u2" }),
  pointer: createMessage(COLAB_SERVER_EVENTS.POINTER, "u1", pointerWithoutScope),
  interaction: createMessage(COLAB_SERVER_EVENTS.INTERACTION, "u1", {
    name: "cursor",
    scopeId: asScopeId("scope-b"),
  }),
} as const;

/** Every fixture message, flattened, for exhaustive serialization iteration. */
export const allMessages: readonly ColabMessage[] = [
  ...Object.values(clientMessages),
  ...Object.values(serverMessages),
];
