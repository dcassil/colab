import { describe, expect, it } from "vitest";

import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import type { Interaction } from "../contracts/interaction.js";
import { createInteractionRegistry } from "./registry.js";

const stubInteraction = (type: string): Interaction => ({
  type,
  reduce: (state) => state,
  toMessage: (): ColabMessage =>
    createMessage(COLAB_EVENTS.INTERACTION, "u1", {
      name: type,
      scopeId: asScopeId("s"),
    }),
});

describe("InteractionRegistry register / get / list (TC-001)", () => {
  it("looks up by type, lists all, and misses return undefined", () => {
    const registry = createInteractionRegistry();
    const cursor = stubInteraction("cursor");
    registry.register(cursor);
    registry.register(stubInteraction("edit-lock"));

    expect(registry.get("cursor")).toBe(cursor);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get("missing")).toBeUndefined();
  });
});

describe("InteractionRegistry duplicate type rejected (TC-002)", () => {
  it("throws naming the duplicate type and keeps the first registration", () => {
    const registry = createInteractionRegistry();
    const first = stubInteraction("cursor");
    registry.register(first);

    expect(() => {
      registry.register(stubInteraction("cursor"));
    }).toThrow(/cursor/);
    expect(registry.get("cursor")).toBe(first);
    expect(registry.list()).toHaveLength(1);
  });
});

describe("InteractionRegistry snapshot immutability", () => {
  it("list() cannot corrupt internal state", () => {
    const registry = createInteractionRegistry();
    registry.register(stubInteraction("cursor"));
    const snapshot = registry.list();
    (snapshot as Interaction[]).push(stubInteraction("x"));
    expect(registry.list()).toHaveLength(1);
  });
});
