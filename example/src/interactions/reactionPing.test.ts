/**
 * Unit tests for the `reactionPing` CUSTOM interaction (PROJ-T-0048).
 *
 * These prove the interaction composes purely on colab's public
 * `defineInteraction` — `reduce` folds inbound pings into state and `toMessage`
 * serializes a local trigger — WITHOUT any colab core edit. Each test builds the
 * interaction against a FRESH registry so the `defineInteraction` duplicate-type
 * guard never fires across the suite (mirrors the reference Cursor tests).
 */
import { describe, expect, it } from "vitest";

import { createInteractionRegistry } from "colab-ui";

import { createReactionPing, REACTION_PING_TYPE } from "./reactionPing.js";
import type { PingState } from "./reactionPing.js";

function fresh() {
  return createReactionPing(createInteractionRegistry());
}

/**
 * The inbound-message type, derived from the descriptor's own `reduce` signature
 * so the test never needs to name colab's `ColabMessage` (which colab-ui does
 * not re-export — see the gap note in `reactionPing.ts`).
 */
type InboundMessage = Parameters<
  ReturnType<typeof createReactionPing>["reduce"]
>[1];

/** An inbound ping message as it arrives from the relay (sender stamped). */
function inbound(
  from: string,
  ping: { id: string; x: number; y: number; expiresAt: number },
): InboundMessage {
  return {
    type: "interaction",
    from,
    payload: {
      name: REACTION_PING_TYPE,
      scopeId: "reaction-ping" as never,
      data: ping,
    },
  };
}

describe("reactionPing.reduce — folds inbound pings immutably", () => {
  it("appends a ping keyed with the sender's id and coordinates", () => {
    const ping = fresh();
    const s0: PingState = { pings: [] };
    const s1 = ping.reduce(
      s0,
      inbound("p1", { id: "a", x: 0.5, y: 0.25, expiresAt: 1000 }),
    );

    expect(s1.pings).toEqual([
      { id: "a", from: "p1", x: 0.5, y: 0.25, expiresAt: 1000 },
    ]);
    // Immutability: input untouched, new array returned.
    expect(s0.pings).toEqual([]);
    expect(s1).not.toBe(s0);
  });

  it("keeps multiple distinct pings and dedupes by id (last wins)", () => {
    const ping = fresh();
    let state: PingState = { pings: [] };
    state = ping.reduce(state, inbound("p1", { id: "a", x: 0.1, y: 0.1, expiresAt: 10 }));
    state = ping.reduce(state, inbound("p2", { id: "b", x: 0.2, y: 0.2, expiresAt: 20 }));
    // Re-send id "a" with new coords — dedup replaces, does not duplicate.
    state = ping.reduce(state, inbound("p1", { id: "a", x: 0.9, y: 0.9, expiresAt: 99 }));

    expect(state.pings).toHaveLength(2);
    expect(state.pings.find((p) => p.id === "a")).toEqual({
      id: "a",
      from: "p1",
      x: 0.9,
      y: 0.9,
      expiresAt: 99,
    });
  });

  it("ignores a message whose payload is not a well-formed ping", () => {
    const ping = fresh();
    const s0: PingState = { pings: [] };
    const s1 = ping.reduce(s0, {
      type: "interaction",
      from: "p1",
      payload: { name: REACTION_PING_TYPE, scopeId: "reaction-ping" as never, data: {} },
    });
    expect(s1).toBe(s0);
  });

  it("ignores a message addressed to a different interaction", () => {
    const ping = fresh();
    const s0: PingState = { pings: [{ id: "a", from: "p1", x: 0.1, y: 0.1, expiresAt: 5 }] };
    const s1 = ping.reduce(s0, {
      type: "interaction",
      from: "p2",
      payload: { name: "cursor", scopeId: "cursor" as never, data: { point: { x: 1, y: 1 } } },
    });
    expect(s1).toBe(s0);
  });
});

describe("reactionPing.toMessage — serializes a local trigger", () => {
  it("emits a reaction-ping interaction message carrying the ping payload", () => {
    const ping = fresh();
    const message = ping.toMessage({ id: "x", x: 0.5, y: 0.5, expiresAt: 1234 });

    // Narrow the discriminated envelope by its `type` — no unsafe cast needed.
    if (message.type !== "interaction") {
      throw new Error("expected an interaction message");
    }
    expect(message.payload.name).toBe(REACTION_PING_TYPE);
    expect(message.payload.data).toEqual({
      id: "x",
      x: 0.5,
      y: 0.5,
      expiresAt: 1234,
    });
  });
});
