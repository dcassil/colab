import { asScopeId } from "colab-protocol";
import type { InteractionPayload } from "colab-protocol";
import { describe, expect, it } from "vitest";

import {
  RoomInteractionStore,
  toClearPayload,
  toLockPayload,
} from "./interaction-state.js";

const scopeA = asScopeId("cell-a");
const scopeB = asScopeId("cell-b");

function lock(scopeId = scopeA): InteractionPayload {
  return { name: "edit-lock", scopeId, data: { action: "lock" } };
}

function clear(scopeId = scopeA): InteractionPayload {
  return { name: "edit-lock", scopeId, data: { action: "clear" } };
}

describe("RoomInteractionStore", () => {
  it("records a lock keyed by (name, scope) → holder", () => {
    const store = new RoomInteractionStore();
    expect(store.apply("room", "alice", lock())).toBe(true);

    expect(store.list("room")).toEqual([
      { name: "edit-lock", scopeId: scopeA, holder: "alice" },
    ]);
  });

  it("drops the lock on clear", () => {
    const store = new RoomInteractionStore();
    store.apply("room", "alice", lock());
    expect(store.apply("room", "alice", clear())).toBe(true);
    expect(store.list("room")).toEqual([]);
  });

  it("ignores non-state-bearing interactions (no lock/clear action)", () => {
    const store = new RoomInteractionStore();
    const transient: InteractionPayload = {
      name: "wave",
      scopeId: scopeA,
      data: { action: "hello" },
    };
    expect(store.apply("room", "alice", transient)).toBe(false);
    expect(store.list("room")).toEqual([]);
  });

  it("rejects a later lock on the same scope from a different holder", () => {
    const store = new RoomInteractionStore();
    store.apply("room", "alice", lock());
    expect(store.accepts("room", "bob", lock())).toBe(false);
    expect(store.apply("room", "bob", lock())).toBe(false);
    expect(store.list("room")).toEqual([
      { name: "edit-lock", scopeId: scopeA, holder: "alice" },
    ]);
  });

  it("allows the current holder to refresh and release before another acquire", () => {
    const store = new RoomInteractionStore();
    expect(store.apply("room", "alice", lock())).toBe(true);
    expect(store.accepts("room", "alice", lock())).toBe(true);
    expect(store.apply("room", "alice", lock())).toBe(false);
    expect(store.apply("room", "alice", clear())).toBe(true);

    expect(store.accepts("room", "bob", lock())).toBe(true);
    expect(store.apply("room", "bob", lock())).toBe(true);
    expect(store.list("room")).toEqual([
      { name: "edit-lock", scopeId: scopeA, holder: "bob" },
    ]);
  });

  it("rejects a clear from a participant that does not hold the lock", () => {
    const store = new RoomInteractionStore();
    store.apply("room", "alice", lock());

    expect(store.accepts("room", "bob", clear())).toBe(false);
    expect(store.apply("room", "bob", clear())).toBe(false);
    expect(store.list("room")).toEqual([
      { name: "edit-lock", scopeId: scopeA, holder: "alice" },
    ]);
  });

  it("drops all of a participant's locks and reports them for broadcast", () => {
    const store = new RoomInteractionStore();
    store.apply("room", "alice", lock(scopeA));
    store.apply("room", "alice", lock(scopeB));
    store.apply("room", "bob", lock(asScopeId("cell-c")));

    const dropped = store.dropParticipant("room", "alice");
    expect(dropped.map((d) => d.scopeId).sort()).toEqual([scopeA, scopeB].sort());
    expect(store.list("room")).toEqual([
      { name: "edit-lock", scopeId: asScopeId("cell-c"), holder: "bob" },
    ]);
  });

  it("round-trips lock/clear payloads for an active lock", () => {
    const active = { name: "edit-lock", scopeId: scopeA, holder: "alice" };
    expect(toLockPayload(active)).toEqual({
      name: "edit-lock",
      scopeId: scopeA,
      data: { action: "lock" },
    });
    expect(toClearPayload(active)).toEqual({
      name: "edit-lock",
      scopeId: scopeA,
      data: { action: "clear" },
    });
  });
});
