import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveIdentity } from "../identity/identityProvider.js";

import { createSocketIoTransport } from "./socketIoTransport.js";
import { runTransportContract } from "./transportContract.js";

/**
 * A module mock for `socket.io-client` that drives an in-memory loopback: all
 * sockets connecting to the same URL share a room-keyed bus, so the shared
 * transport contract suite runs with no real socket or server. The mock also
 * records `io` invocations for the handshake-auth assertions.
 */
interface FakeSocket {
  url: string;
  auth: unknown;
  room: string | undefined;
  handlers: Map<string, (payload: unknown) => void>;
}

const ioCalls: { url: string; auth: unknown }[] = [];
let buses: Map<string, Set<FakeSocket>>;
let ioFactoryInvocations = 0;

vi.mock("socket.io-client", () => {
  const io = (url: string, opts: { auth: unknown }): unknown => {
    ioFactoryInvocations += 1;
    ioCalls.push({ url, auth: opts.auth });
    const bus = buses.get(url) ?? new Set<FakeSocket>();
    buses.set(url, bus);
    const self: FakeSocket = {
      url,
      auth: opts.auth,
      room: undefined,
      handlers: new Map(),
    };
    return {
      on(event: string, handler: (payload: unknown) => void) {
        self.handlers.set(event, handler);
        // Resolve `connect` on the next microtask, mimicking async handshake.
        if (event === "connect") {
          void Promise.resolve().then(() => {
            handler(undefined);
          });
        }
      },
      off(event?: string) {
        if (event === undefined) self.handlers.clear();
        else self.handlers.delete(event);
      },
      emit(event: string, ...args: unknown[]) {
        if (event === "join") {
          self.room = args[0] as string;
          bus.add(self);
          return;
        }
        if (event === "leave") {
          bus.delete(self);
          return;
        }
        if (event === "colab:msg") {
          for (const peer of Array.from(bus)) {
            if (peer === self) continue; // no self-echo, matching the contract
            peer.handlers.get("colab:msg")?.(args[0]);
          }
        }
      },
      disconnect() {
        bus.delete(self);
        self.handlers.clear();
      },
    };
  };
  return { io };
});

beforeEach(() => {
  buses = new Map();
  ioCalls.length = 0;
  ioFactoryInvocations = 0;
});

// TC-004: the socket transport passes the SAME shared contract suite as the
// in-memory transport, run over the mocked socket. `room` is encoded per peer
// as a distinct URL path so the loopback bus keys rooms apart.
runTransportContract(
  (room) => createSocketIoTransport({ url: `wss://test/${room}`, room }),
  {
    label: "socket.io (mocked loopback)",
    beforeEachHook: () => {
      buses = new Map();
    },
  },
);

describe("createSocketIoTransport lazy import + handshake", () => {
  afterEach(() => {
    buses = new Map();
  });

  // TC-001: socket.io-client not loaded until connect.
  it("does not invoke the io factory until connect() is called", async () => {
    const t = createSocketIoTransport({ url: "wss://test/r", room: "r" });
    expect(ioFactoryInvocations).toBe(0);

    await t.connect();

    expect(ioFactoryInvocations).toBe(1);
  });

  // TC-003: identity/token flow into handshake auth.
  it("passes identity and token into the io() handshake auth", async () => {
    const identity = { id: "a", name: "A", color: "#0f0" };
    const t = createSocketIoTransport({
      url: "wss://test/r",
      room: "r",
      identity,
      token: "jwt",
    });

    await t.connect();

    expect(ioCalls).toHaveLength(1);
    expect(ioCalls[0]?.auth).toEqual({ identity, token: "jwt" });
  });

  // TC-004: resolved credentials travel unbroken into the handshake auth.
  it("places resolveIdentity credentials into the io() handshake auth", async () => {
    const identity = { id: "a", name: "A", color: "#0f0" };
    const creds = await resolveIdentity({ identity, token: "jwt" });
    const t = createSocketIoTransport({
      url: "wss://test/r",
      room: "r",
      credentials: creds,
    });

    await t.connect();

    expect(ioCalls[0]?.auth).toEqual({ identity, token: "jwt" });
  });

  it("throws when send() is called before connect()", () => {
    const t = createSocketIoTransport({ url: "wss://test/r", room: "r" });
    expect(() => {
      t.send({ type: "pointer", from: "a", payload: { x: 0, y: 0 } });
    }).toThrow(/before connect/);
  });

  it("throws when send() is called after disconnect()", async () => {
    const t = createSocketIoTransport({ url: "wss://test/r", room: "r" });
    await t.connect();
    await t.disconnect();
    expect(() => {
      t.send({ type: "pointer", from: "a", payload: { x: 0, y: 0 } });
    }).toThrow();
  });
});
