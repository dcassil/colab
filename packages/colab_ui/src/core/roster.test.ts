import { describe, expect, it, vi } from "vitest";

import type { Participant } from "colab-protocol";

import { createRoster } from "./roster.js";

const p = (id: string, name = id): Participant => ({
  id,
  name,
  color: "#000",
});

const ids = (list: readonly Participant[]): string[] =>
  list.map((x) => x.id).sort();

describe("Roster leave removes exactly the target (TC-001)", () => {
  it("removes only B and notifies once", () => {
    const roster = createRoster();
    roster.applyJoin(p("A"));
    roster.applyJoin(p("B"));
    roster.applyJoin(p("C"));

    const listener = vi.fn();
    roster.subscribe(listener);
    roster.applyLeave("B");

    expect(ids(roster.getParticipants())).toEqual(["A", "C"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("Roster update + silent no-op leave (TC-002)", () => {
  it("update mutates without duplicating", () => {
    const roster = createRoster();
    roster.applyJoin(p("A", "A"));
    roster.applyUpdate(p("A", "A2"));

    const list = roster.getParticipants();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("A2");
  });

  it("leave of unknown id fires no notification", () => {
    const roster = createRoster();
    roster.applyJoin(p("A"));
    const listener = vi.fn();
    roster.subscribe(listener);

    roster.applyLeave("unknown-id");

    expect(listener).not.toHaveBeenCalled();
    expect(ids(roster.getParticipants())).toEqual(["A"]);
  });
});

describe("Roster mutation + notification semantics", () => {
  it("upserts an update for an unknown id", () => {
    const roster = createRoster();
    const listener = vi.fn();
    roster.subscribe(listener);
    roster.applyUpdate(p("Z"));
    expect(ids(roster.getParticipants())).toEqual(["Z"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when a join re-adds an identical participant", () => {
    const roster = createRoster();
    roster.applyJoin(p("A"));
    const listener = vi.fn();
    roster.subscribe(listener);
    roster.applyJoin(p("A"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("double leave is a silent no-op the second time", () => {
    const roster = createRoster();
    roster.applyJoin(p("A"));
    const listener = vi.fn();
    roster.subscribe(listener);
    roster.applyLeave("A");
    roster.applyLeave("A");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns an immutable snapshot that cannot corrupt internal state", () => {
    const roster = createRoster();
    roster.applyJoin(p("A"));
    const snapshot = roster.getParticipants();
    (snapshot as Participant[]).push(p("X"));
    expect(ids(roster.getParticipants())).toEqual(["A"]);
  });

  it("unsubscribe stops further notifications", () => {
    const roster = createRoster();
    const listener = vi.fn();
    const off = roster.subscribe(listener);
    off();
    roster.applyJoin(p("A"));
    expect(listener).not.toHaveBeenCalled();
  });
});
