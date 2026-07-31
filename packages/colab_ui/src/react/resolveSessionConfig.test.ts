import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import { resolveSessionConfig } from "./resolveSessionConfig.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

describe("resolveSessionConfig seam defaulting (TC-001)", () => {
  it("defaults transport + store from the I3 seams when props are omitted", () => {
    const config = resolveSessionConfig({
      serverUrl: "https://relay.example",
      room: "board-42",
      identity,
    });

    // A default transport was constructed (satisfies the I2 seam shape) and no
    // network call occurred — construction is pure/lazy.
    expect(typeof config.deps.transport.connect).toBe("function");
    expect(typeof config.deps.transport.send).toBe("function");
    // A default in-memory store was constructed (get/set/subscribe present).
    expect(typeof config.deps.store.get).toBe("function");
    expect(typeof config.deps.store.subscribe).toBe("function");
    expect(config.room).toBe("board-42");
    expect(config.identity).toBe(identity);
    expect(config.interactions).toEqual([]);
  });
});

describe("resolveSessionConfig seam override (TC-002)", () => {
  it("uses the supplied transport + store instances verbatim", () => {
    const fakeT = createFakeTransport();
    const fakeS = createFakeStore();

    const config = resolveSessionConfig({
      serverUrl: "https://relay.example",
      room: "board-42",
      identity,
      transport: fakeT,
      store: fakeS,
    });

    expect(config.deps.transport).toBe(fakeT);
    expect(config.deps.store).toBe(fakeS);
    // No default transport connected as a side effect of resolving config.
    expect(fakeT.connectCalls()).toBe(0);
  });

  it("passes interactions through unchanged", () => {
    const interaction = {
      type: "editLock",
      reduce: (state: unknown) => state,
      toMessage: () => ({
        type: "interaction" as const,
        from: "me",
        payload: { name: "editLock", scopeId: "s" as never },
      }),
    };
    const config = resolveSessionConfig({
      serverUrl: "https://relay.example",
      room: "r",
      identity,
      transport: createFakeTransport(),
      store: createFakeStore(),
      interactions: [interaction],
    });
    expect(config.interactions).toEqual([interaction]);
  });
});
