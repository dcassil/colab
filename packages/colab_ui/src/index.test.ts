import { describe, expect, it } from "vitest";

import {
  COLAB_EVENTS,
  asScopeId,
  createMessage,
} from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import type { ColabStore, ColabTransport, Interaction } from "./index.js";

describe("seam contracts are implementable (TC-001)", () => {
  it("a trivial ColabTransport type-checks and runs", () => {
    const sent: ColabMessage[] = [];
    const transport: ColabTransport = {
      connect: () => undefined,
      disconnect: () => undefined,
      send: (message) => sent.push(message),
      subscribe: () => () => undefined,
    };
    void transport.connect();
    transport.send(
      createMessage(COLAB_EVENTS.LEAVE, "u1", { id: "u1" }),
    );
    expect(sent).toHaveLength(1);
  });

  it("a trivial ColabStore type-checks and runs", () => {
    const backing = new Map<string, unknown>();
    const store: ColabStore = {
      get: (key) => backing.get(key),
      set: (key, value) => void backing.set(key, value),
      subscribe: () => () => undefined,
    };
    store.set("k", 42);
    expect(store.get("k")).toBe(42);
  });
});

describe("Interaction generic state is preserved (TC-002)", () => {
  it("flows the state type into reduce and back", () => {
    interface LockState {
      locked: boolean;
    }
    const interaction: Interaction<LockState> = {
      type: "lock",
      reduce: (state): LockState => ({ locked: !state.locked }),
      toMessage: (): ColabMessage =>
        createMessage(COLAB_EVENTS.INTERACTION, "u1", {
          name: "lock",
          scopeId: asScopeId("s"),
        }),
    };
    const next = interaction.reduce({ locked: false }, interaction.toMessage(0));
    expect(next.locked).toBe(true);
  });
});
