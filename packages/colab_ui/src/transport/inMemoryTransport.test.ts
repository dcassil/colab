import { createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";
import { describe, expect, it, vi } from "vitest";

import { createHub } from "./hub.js";
import { createInMemoryTransport } from "./inMemoryTransport.js";
import { runTransportContract } from "./transportContract.js";

// The in-memory transport must pass the SHARED contract suite in full. Each
// case runs on a freshly isolated hub so rooms never leak across cases.
{
  let hub = createHub();
  runTransportContract(
    (room) => createInMemoryTransport({ room, hub }),
    {
      label: "in-memory (isolated hub per case)",
      beforeEachHook: () => {
        hub = createHub();
      },
    },
  );
}

const pointer = (from: string): ColabMessage =>
  createMessage("pointer", from, { x: 1, y: 2 });

describe("createInMemoryTransport (hub path specifics)", () => {
  // TC-003: disconnect leaves no leaked listeners in the hub.
  it("leaves zero hub listeners after all peers disconnect", async () => {
    const hub = createHub();
    const a = createInMemoryTransport({ room: "r", hub });
    const b = createInMemoryTransport({ room: "r", hub });
    await a.connect();
    await b.connect();
    expect(hub.listenerCount("r")).toBe(2);

    await a.disconnect();
    await b.disconnect();

    expect(hub.listenerCount("r")).toBe(0);
  });

  it("carries identity via envelope for roster attribution", async () => {
    const hub = createHub();
    const a = createInMemoryTransport({ room: "r", hub });
    const b = createInMemoryTransport({
      room: "r",
      hub,
      identity: { id: "b", name: "B", color: "#000" },
    });
    await a.connect();
    await b.connect();
    const spy = vi.fn();
    a.subscribe(spy);

    b.send(createMessage("join", "b", { id: "b", name: "B", color: "#000" }));

    expect((spy.mock.calls[0]?.[0] as ColabMessage).from).toBe("b");
  });

  // TC-004: BroadcastChannel feature-detect fallback. Stub the global away to
  // prove the module loads and transparently uses the in-process hub without a
  // `BroadcastChannel`, exactly as it would under a Node runtime lacking one.
  it("falls back to the in-process hub when BroadcastChannel is absent", async () => {
    const holder = globalThis as { BroadcastChannel?: unknown };
    const saved = holder.BroadcastChannel;
    delete holder.BroadcastChannel;
    try {
      const hub = createHub();
      const a = createInMemoryTransport({ room: "r", hub, channelName: "x" });
      const b = createInMemoryTransport({ room: "r", hub, channelName: "x" });
      await a.connect();
      await b.connect();
      const spy = vi.fn();
      a.subscribe(spy);

      b.send(pointer("b"));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(hub.listenerCount("r")).toBe(2);
    } finally {
      holder.BroadcastChannel = saved;
    }
  });

  // When a real BroadcastChannel global exists AND a channel name is given, the
  // transport uses it; delivery is async, so the assertion awaits a tick.
  it("uses a real BroadcastChannel when the global exists", async () => {
    expect(
      typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel,
    ).toBe("function");
    const a = createInMemoryTransport({ channelName: "colab-test-chan" });
    const b = createInMemoryTransport({ channelName: "colab-test-chan" });
    await a.connect();
    await b.connect();
    const received: ColabMessage[] = [];
    a.subscribe((m) => received.push(m));

    b.send(pointer("b"));
    // BroadcastChannel delivery is async; poll until the envelope arrives.
    await vi.waitFor(() => {
      expect(received.map((m) => m.from)).toEqual(["b"]);
    });

    await a.disconnect();
    await b.disconnect();
  });

  // Integration: two transports through one hub, end-to-end join→send→leave.
  it("connects two peers end-to-end with no server", async () => {
    const hub = createHub();
    const alice = createInMemoryTransport({ room: "room-1", hub });
    const bob = createInMemoryTransport({ room: "room-1", hub });
    await alice.connect();
    await bob.connect();

    const aliceInbox: ColabMessage[] = [];
    const bobInbox: ColabMessage[] = [];
    alice.subscribe((m) => aliceInbox.push(m));
    bob.subscribe((m) => bobInbox.push(m));

    bob.send(createMessage("join", "bob", { id: "bob", name: "Bob", color: "#f00" }));
    alice.send(pointer("alice"));

    expect(aliceInbox.map((m) => m.from)).toEqual(["bob"]);
    expect(bobInbox.map((m) => m.from)).toEqual(["alice"]);

    await bob.disconnect();
    aliceInbox.length = 0;
    alice.send(pointer("alice"));
    expect(aliceInbox).toHaveLength(0);
  });
});
