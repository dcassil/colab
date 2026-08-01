/**
 * Pure unit tests for the reference `Cursor` interaction (PROJ-T-0031).
 *
 * `reduce` / `toMessage` / `selectors` are exercised in isolation — no live
 * transport, no DOM. Each `createCursorInteraction` call is given a FRESH
 * registry so the T1 duplicate-type guard does not fire across tests.
 */
import { COLAB_EVENTS, createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";
import { describe, expect, it } from "vitest";

import { createInteractionRegistry } from "../../core/registry.js";
import { createCursorInteraction } from "./cursor.js";
import type { CursorPoint, CursorState } from "./cursor.js";

function freshCursor() {
  return createCursorInteraction(createInteractionRegistry());
}

function inbound(from: string, point: CursorPoint): ColabMessage {
  return createMessage(COLAB_EVENTS.INTERACTION, from, {
    name: "cursor",
    scopeId: "cursor" as never,
    data: { point },
  });
}

describe("Cursor.reduce — folds remote points immutably (TC-001)", () => {
  it("keys each sender's point by `from` and returns new state", () => {
    const cursor = freshCursor();
    const s0: CursorState = {};
    const s1 = cursor.reduce(s0, inbound("p1", { x: 0.2, y: 0.3 }));
    const s2 = cursor.reduce(s1, inbound("p2", { x: 0.7, y: 0.8 }));

    expect(s2).toEqual({
      p1: { x: 0.2, y: 0.3 },
      p2: { x: 0.7, y: 0.8 },
    });
    // Immutability: inputs untouched, each call a new object.
    expect(s0).toEqual({});
    expect(s1).not.toBe(s2);
    expect(s1).toEqual({ p1: { x: 0.2, y: 0.3 } });
  });

  it("returns state unchanged when the payload carries no point", () => {
    const cursor = freshCursor();
    const s0: CursorState = { p1: { x: 0.1, y: 0.1 } };
    const s1 = cursor.reduce(s0, {
      type: COLAB_EVENTS.INTERACTION,
      from: "p2",
      payload: { name: "cursor", scopeId: "cursor" as never, data: {} },
    });
    expect(s1).toBe(s0);
  });
});

describe("Cursor.toMessage — normalized + tagged, no transform (TC-002)", () => {
  it("emits a `cursor` interaction message carrying the raw point", () => {
    const cursor = freshCursor();
    const message = cursor.toMessage({ x: 0.5, y: 0.5 });
    expect(message.type).toBe(COLAB_EVENTS.INTERACTION);
    const payload = message.payload as {
      name: string;
      data: { point: CursorPoint };
    };
    expect(payload.name).toBe("cursor");
    expect(payload.data.point).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("Cursor.selectors — remoteCursors + roster reconciliation (TC-003)", () => {
  it("remoteCursors returns every known entry", () => {
    const cursor = freshCursor();
    const state: CursorState = {
      p1: { x: 0.2, y: 0.3 },
      p2: { x: 0.4, y: 0.5 },
    };
    expect(cursor.selectors.remoteCursors(state)).toEqual([
      { participantId: "p1", point: { x: 0.2, y: 0.3 } },
      { participantId: "p2", point: { x: 0.4, y: 0.5 } },
    ]);
  });

  it("presentCursors filters departed participants out against the roster", () => {
    const cursor = freshCursor();
    const state: CursorState = {
      p1: { x: 0.2, y: 0.3 },
      p2: { x: 0.4, y: 0.5 },
    };
    const present = cursor.selectors.presentCursors(state)(["p1"]);
    expect(present).toEqual([{ participantId: "p1", point: { x: 0.2, y: 0.3 } }]);
  });
});
