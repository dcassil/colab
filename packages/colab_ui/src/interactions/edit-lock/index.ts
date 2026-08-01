import {
  COLAB_EVENTS,
  asScopeId,
  createMessage,
} from "colab-protocol";
import type { ColabMessage, Participant, ScopeId } from "colab-protocol";

import { defineInteraction } from "../../interaction/index.js";

export const EDIT_LOCK_TYPE = "edit-lock";

export type ParticipantId = Participant["id"];
export type EditLockAction = "lock" | "clear";
export type EditLockState = Record<ScopeId, ParticipantId>;

export interface EditLockEvent {
  scopeId: ScopeId;
  action: EditLockAction;
}

export type EditLockSelectors = {
  isLocked: (state: EditLockState) => (scopeId: ScopeId) => boolean;
  lockedBy: (
    state: EditLockState,
  ) => (scopeId: ScopeId) => ParticipantId | null;
} & Record<string, (state: EditLockState) => unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readEvent(message: ColabMessage): EditLockEvent | null {
  const payload: Record<string, unknown> = isRecord(message.payload)
    ? message.payload
    : {};
  if (!isRecord(payload) || payload.name !== EDIT_LOCK_TYPE) return null;

  const data = payload.data;
  if (!isRecord(data)) return null;

  const action = data.action;
  if (action !== "lock" && action !== "clear") return null;

  return {
    scopeId: asScopeId(String(payload.scopeId)),
    action,
  };
}

function omit(state: EditLockState, scopeId: ScopeId): EditLockState {
  const next: EditLockState = {};
  for (const [key, value] of Object.entries(state)) {
    if (key !== scopeId) next[asScopeId(key)] = value;
  }
  return next;
}

export function reconcileEditLocks(
  state: EditLockState,
  present: readonly Pick<Participant, "id">[],
): EditLockState {
  const presentIds = new Set(present.map((participant) => participant.id));
  const next: EditLockState = {};

  for (const [key, owner] of Object.entries(state)) {
    if (presentIds.has(owner)) next[asScopeId(key)] = owner;
  }

  return next;
}

export const EditLock = defineInteraction<
  EditLockState,
  EditLockEvent,
  EditLockSelectors
>({
  type: EDIT_LOCK_TYPE,
  initialState: {},
  reduce: (state, message): EditLockState => {
    const event = readEvent(message);
    if (event === null) return state;

    if (event.action === "clear") return omit(state, event.scopeId);
    return { ...state, [event.scopeId]: message.from };
  },
  toMessage: (event): ColabMessage =>
    createMessage(COLAB_EVENTS.INTERACTION, "", {
      name: EDIT_LOCK_TYPE,
      scopeId: event.scopeId,
      data: { action: event.action },
    }),
  selectors: {
    isLocked: (state) => (scopeId) => scopeId in state,
    lockedBy: (state) => (scopeId) => state[scopeId] ?? null,
  },
});
