import { useContext } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ColabMessage, Identity } from "colab-protocol";

import type { ColabStore } from "../contracts/store.js";
import type { ColabTransport } from "../contracts/transport.js";
import { ColabProvider } from "./ColabProvider.js";
import { ColabContext } from "./context.js";
import type { ColabContextValue } from "./types.js";

const seams = vi.hoisted(() => {
  const sent: ColabMessage[] = [];
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const connect = vi.fn(() => undefined);
  const disconnect = vi.fn(() => undefined);
  const send = vi.fn((message: ColabMessage) => {
    sent.push(message);
  });
  const subscribe = vi.fn((next: (message: ColabMessage) => void) => {
    void next;
    return () => undefined;
  });

  const transport: ColabTransport & { sent: ColabMessage[] } = {
    sent,
    connect,
    disconnect,
    send,
    subscribe,
  };

  const store: ColabStore = {
    get: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      for (const listener of listeners.get(key) ?? []) listener();
    },
    subscribe: (key, listener) => {
      const keyListeners = listeners.get(key) ?? new Set<() => void>();
      keyListeners.add(listener);
      listeners.set(key, keyListeners);
      return () => {
        keyListeners.delete(listener);
      };
    },
  };

  return {
    createInMemoryStore: vi.fn(() => store),
    createSocketIoTransport: vi.fn(() => transport),
    connect,
    reset: () => {
      sent.length = 0;
      values.clear();
      listeners.clear();
      vi.clearAllMocks();
    },
    send,
    store,
    subscribe,
    transport,
  };
});

vi.mock("../store/index.js", () => ({
  createInMemoryStore: seams.createInMemoryStore,
}));

vi.mock("../transport/index.js", () => ({
  createSocketIoTransport: seams.createSocketIoTransport,
}));

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

describe("ColabProvider default seams", () => {
  beforeEach(() => {
    seams.reset();
  });

  it("uses the I3 default transport and store for the three-prop path", () => {
    let observed: ColabContextValue | null = null;
    function Probe(): null {
      observed = useContext(ColabContext);
      return null;
    }

    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="board-42"
        identity={identity}
      >
        <Probe />
      </ColabProvider>,
    );

    expect(seams.createSocketIoTransport).toHaveBeenCalledWith({
      url: "https://relay.example",
      room: "board-42",
      identity,
    });
    expect(seams.createInMemoryStore).toHaveBeenCalledTimes(1);
    expect(observed?.store).toBe(seams.store);
    expect(seams.connect).toHaveBeenCalledTimes(1);
    expect(seams.connect).toHaveBeenCalledWith();
    expect(seams.transport.sent.some((m) => m.type === "join")).toBe(true);
    view.unmount();
  });

  it("does not construct default seams when overrides are supplied", () => {
    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="board-42"
        identity={identity}
        transport={seams.transport}
        store={seams.store}
      />,
    );

    expect(seams.createSocketIoTransport).not.toHaveBeenCalled();
    expect(seams.createInMemoryStore).not.toHaveBeenCalled();
    expect(seams.connect).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
