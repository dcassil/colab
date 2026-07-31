import { describe, expect, it } from "vitest";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  asScopeId,
  createMessage,
} from "colab-protocol";
import type { ColabMessage, Participant, ScopeId } from "colab-protocol";

import {
  EDIT_LOCK_TYPE,
  EditLock,
  reconcileEditLocks,
} from "./index.js";
import type { EditLockState } from "./index.js";

function inbound(
  from: string,
  scopeId: string,
  action: "lock" | "clear",
): ColabMessage {
  return createMessage(COLAB_SERVER_EVENTS.INTERACTION, from, {
    name: EDIT_LOCK_TYPE,
    scopeId: asScopeId(scopeId),
    data: { action },
  });
}

const scope = (value: string): ScopeId => asScopeId(value);

describe("EditLock reduce/toMessage (TC-001, TC-003)", () => {
  it("locks by envelope sender and clears with a new state object", () => {
    const before: EditLockState = {};
    const locked = EditLock.reduce(before, inbound("p1", "email", "lock"));

    expect(locked).toEqual({ email: "p1" });
    expect(locked).not.toBe(before);
    expect(before).toEqual({});

    const cleared = EditLock.reduce(locked, inbound("p1", "email", "clear"));
    expect(cleared).toEqual({});
    expect(cleared).not.toBe(locked);
  });

  it("uses last-writer-wins for conflicting remote locks", () => {
    const state: EditLockState = { [scope("email")]: "p1" };

    expect(() => EditLock.reduce(state, inbound("p2", "email", "lock"))).not.toThrow();
    expect(EditLock.reduce(state, inbound("p2", "email", "lock"))).toEqual({
      email: "p2",
    });
  });

  it("maps local events to the public interaction message payload", () => {
    expect(EditLock.toMessage({ scopeId: scope("email"), action: "lock" })).toEqual(
      createMessage(COLAB_EVENTS.INTERACTION, "", {
        name: EDIT_LOCK_TYPE,
        scopeId: scope("email"),
        data: { action: "lock" },
      }),
    );
  });
});

describe("EditLock selectors (TC-002)", () => {
  it("surfaces parameterized lock and owner reads", () => {
    const state: EditLockState = { [scope("email")]: "p1" };

    expect(EditLock.selectors.isLocked(state)(scope("email"))).toBe(true);
    expect(EditLock.selectors.isLocked(state)(scope("name"))).toBe(false);
    expect(EditLock.selectors.lockedBy(state)(scope("email"))).toBe("p1");
    expect(EditLock.selectors.lockedBy(state)(scope("name"))).toBeNull();
  });
});

describe("EditLock roster reconciliation (TC-004)", () => {
  it("drops locks owned by departed participants", () => {
    const state: EditLockState = {
      [scope("email")]: "p1",
      [scope("name")]: "p2",
    };
    const present: readonly Participant[] = [
      { id: "p1", name: "Ava", color: "#f00" },
    ];

    expect(reconcileEditLocks(state, present)).toEqual({ email: "p1" });
  });
});
