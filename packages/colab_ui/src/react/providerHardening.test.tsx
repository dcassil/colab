import { useContext } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, asScopeId } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import type { Interaction } from "../contracts/interaction.js";
import { ColabProvider } from "./ColabProvider.js";
import { ColabContext } from "./context.js";
import type { ColabContextValue } from "./types.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };
const otherIdentity: Identity = { id: "you", name: "You", color: "#000" };

const editLock: Interaction<{ locked: boolean }> = {
  type: "editLock",
  reduce: (state) => state,
  toMessage: (): ColabMessage => ({
    type: COLAB_EVENTS.INTERACTION,
    from: "me",
    payload: { name: "editLock", scopeId: asScopeId("field-1") },
  }),
};

describe("ColabProvider override hardening", () => {
  it("uses supplied seams, registers interactions, and resolves getToken", async () => {
    const transport = createFakeTransport();
    const store = createFakeStore();
    const getToken = vi.fn(() => Promise.resolve("token-1"));
    let observed: ColabContextValue | null = null;
    function Probe(): null {
      observed = useContext(ColabContext);
      return null;
    }

    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={transport}
        store={store}
        interactions={[editLock]}
        getToken={getToken}
      >
        <Probe />
      </ColabProvider>,
    );

    const context = requireContext(observed);
    expect(context.store).toBe(store);
    expect(context.session.registry.get("editLock")).toBe(editLock);
    expect(transport.connectCalls()).toBe(1);
    await waitFor(() => {
      expect(getToken).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(transport.sent.some((m) => m.type === "join")).toBe(true);
    });
    view.unmount();
  });
});

describe("ColabProvider dependency hardening", () => {
  it("disconnects the old transport before connecting a new seam", () => {
    const calls: string[] = [];
    const first = createOrderedTransport("first", calls);
    const second = createOrderedTransport("second", calls);
    const store: ColabStore = createFakeStore();
    const tree = (transport: FakeTransport): React.ReactElement => (
      <ColabProvider
        serverUrl="https://relay.example"
        room="a"
        identity={identity}
        transport={transport}
        store={store}
      />
    );

    const view = render(tree(first));
    expect(calls).toEqual(["first:connect"]);
    view.rerender(tree(second));
    expect(calls).toEqual(["first:connect", "first:disconnect", "second:connect"]);
    view.unmount();
    expect(calls).toEqual([
      "first:connect",
      "first:disconnect",
      "second:connect",
      "second:disconnect",
    ]);
  });

  it("recreates the session when identity changes", () => {
    let observed: ColabContextValue | null = null;
    function Probe(): null {
      observed = useContext(ColabContext);
      return null;
    }
    const transport = createFakeTransport();
    const store = createFakeStore();
    const tree = (id: Identity): React.ReactElement => (
      <ColabProvider
        serverUrl="https://relay.example"
        room="a"
        identity={id}
        transport={transport}
        store={store}
      >
        <Probe />
      </ColabProvider>
    );

    const view = render(tree(identity));
    const first = requireContext(observed).session;
    view.rerender(tree(otherIdentity));
    expect(requireContext(observed).session).not.toBe(first);
    expect(transport.connectCalls()).toBe(2);
    expect(transport.disconnectCalls()).toBe(1);
    view.unmount();
  });
});

function createOrderedTransport(label: string, calls: string[]): FakeTransport {
  const base = createFakeTransport();
  return {
    ...base,
    connect: () => {
      calls.push(`${label}:connect`);
      return base.connect();
    },
    disconnect: () => {
      calls.push(`${label}:disconnect`);
      return base.disconnect();
    },
  };
}

function requireContext(value: ColabContextValue | null): ColabContextValue {
  if (value === null) throw new Error("Expected ColabContext to be present");
  return value;
}
