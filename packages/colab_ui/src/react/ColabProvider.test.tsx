import { StrictMode, useContext } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import { ColabContext } from "./context.js";
import { ColabProvider } from "./ColabProvider.js";
import type { ColabContextValue } from "./types.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

function renderProvider(
  transport: FakeTransport,
  extra: { strict?: boolean; room?: string } = {},
): { unmount: () => void; rerender: (room: string) => void; ctx: () => ColabContextValue | null } {
  let observed: ColabContextValue | null = null;
  const store: ColabStore = createFakeStore();
  function Probe(): null {
    observed = useContext(ColabContext);
    return null;
  }
  const tree = (room: string): React.ReactElement => {
    const inner = (
      <ColabProvider
        serverUrl="https://relay.example"
        room={room}
        identity={identity}
        transport={transport}
        store={store}
      >
        <Probe />
      </ColabProvider>
    );
    return extra.strict === true ? <StrictMode>{inner}</StrictMode> : inner;
  };
  const view = render(tree(extra.room ?? "a"));
  return {
    unmount: view.unmount,
    rerender: (room) => {
      view.rerender(tree(room));
    },
    ctx: () => observed,
  };
}

describe("ColabProvider lifecycle (TC-001)", () => {
  it("connects on mount and disconnects on unmount", () => {
    const transport = createFakeTransport();
    const view = renderProvider(transport);

    expect(transport.connectCalls()).toBe(1);
    expect(transport.hasSubscriber()).toBe(true);
    // The local participant announced its join.
    expect(transport.sent.some((m) => m.type === "join")).toBe(true);

    view.unmount();
    expect(transport.disconnectCalls()).toBe(1);
    expect(transport.hasSubscriber()).toBe(false);
  });

  it("provides a { session } context value", () => {
    const transport = createFakeTransport();
    const view = renderProvider(transport);
    const ctx = view.ctx();
    expect(ctx).not.toBeNull();
    expect(ctx?.session).toBeDefined();
    view.unmount();
  });
});

describe("ColabProvider Strict-Mode safety (TC-002)", () => {
  it("keeps exactly one live connection after double-invoked effects", () => {
    const transport = createFakeTransport();
    const view = renderProvider(transport, { strict: true });

    // Strict Mode double-invokes the effect (mount → cleanup → mount). The
    // guarded lifecycle must leave exactly one live connection, balanced.
    expect(transport.hasSubscriber()).toBe(true);
    expect(transport.connectCalls() - transport.disconnectCalls()).toBe(1);

    view.unmount();
    expect(transport.connectCalls()).toBe(transport.disconnectCalls());
    expect(transport.hasSubscriber()).toBe(false);
  });
});

describe("ColabProvider dependency change (TC-003)", () => {
  it("tears down the old session before connecting the new one on room change", () => {
    const transport = createFakeTransport();
    const view = renderProvider(transport, { room: "a" });
    const first = view.ctx()?.session;

    expect(transport.connectCalls()).toBe(1);

    view.rerender("b");
    const second = view.ctx()?.session;

    // A new session was created; the old one was disconnected before the new
    // one connected (balanced counts, one net live connection).
    expect(second).not.toBe(first);
    expect(transport.disconnectCalls()).toBe(1);
    expect(transport.connectCalls()).toBe(2);
    expect(transport.hasSubscriber()).toBe(true);

    view.unmount();
    expect(transport.connectCalls()).toBe(transport.disconnectCalls());
  });

  it("does not rebuild the session on a re-render with unchanged inputs", () => {
    const transport = createFakeTransport();
    const view = renderProvider(transport, { room: "a" });
    const first = view.ctx()?.session;
    view.rerender("a");
    expect(view.ctx()?.session).toBe(first);
    expect(transport.connectCalls()).toBe(1);
    view.unmount();
  });
});
