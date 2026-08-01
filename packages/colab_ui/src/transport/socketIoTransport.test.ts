import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { ColabMessage, Identity, Participant } from "colab-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveIdentity } from "../identity/identityProvider.js";

import { createSocketIoTransport } from "./socketIoTransport.js";
import { runTransportContract } from "./transportContract.js";

/**
 * A module mock for `socket.io-client` that drives an in-memory loopback
 * MIRRORING THE DEFAULT SERVER'S REAL PROTOCOL: sockets join the room named in
 * their handshake `auth.roomId`, and per-type client events
 * (`pointer`/`interaction`/`update`/`leave`) are re-emitted to peers on the
 * server channels (`server_pointer`/`server_interaction`, participant lifecycle)
 * — never a `colab:msg` catch-all. The mock also records `io` invocations for
 * the handshake-auth assertions.
 */
interface FakeSocket {
  url: string;
  auth: { roomId?: string; identity?: Identity; token?: string };
  handlers: Map<string, (payload: unknown) => void>;
}

const ioCalls: { url: string; auth: unknown }[] = [];
let buses: Map<string, Set<FakeSocket>>;
let ioFactoryInvocations = 0;

vi.mock("socket.io-client", () => {
  const io = (
    url: string,
    opts: { auth: { roomId?: string; identity?: Identity; token?: string } },
  ): unknown => {
    ioFactoryInvocations += 1;
    ioCalls.push({ url, auth: opts.auth });
    const self: FakeSocket = {
      url,
      auth: opts.auth,
      handlers: new Map(),
    };
    const key = `${url}::${opts.auth.roomId ?? "default"}`;
    const bus = buses.get(key) ?? new Set<FakeSocket>();
    buses.set(key, bus);

    const broadcast = (event: string, message: unknown): void => {
      for (const peer of Array.from(bus)) {
        if (peer === self) continue; // no self-echo, matching the server
        peer.handlers.get(event)?.(message);
      }
    };

    return {
      on(event: string, handler: (payload: unknown) => void) {
        self.handlers.set(event, handler);
        if (event === "connect") {
          // Join on connect (handshake-driven), then resolve on next microtask.
          void Promise.resolve().then(() => {
            bus.add(self);
            handler(undefined);
          });
        }
      },
      off(event?: string) {
        if (event === undefined) self.handlers.clear();
        else self.handlers.delete(event);
      },
      emit(event: string, ...args: unknown[]) {
        const message = args[0] as ColabMessage;
        if (event === COLAB_EVENTS.POINTER) {
          broadcast(
            COLAB_SERVER_EVENTS.POINTER,
            createMessage(COLAB_SERVER_EVENTS.POINTER, message.from, message.payload),
          );
          return;
        }
        if (event === COLAB_EVENTS.INTERACTION) {
          broadcast(
            COLAB_SERVER_EVENTS.INTERACTION,
            createMessage(
              COLAB_SERVER_EVENTS.INTERACTION,
              message.from,
              message.payload,
            ),
          );
          return;
        }
        if (event === COLAB_EVENTS.UPDATE) {
          broadcast(
            COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
            createMessage(
              COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
              message.from,
              message.payload as Participant,
            ),
          );
          return;
        }
        if (event === COLAB_EVENTS.LEAVE) {
          bus.delete(self);
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

const stubIdentity = (id: string): Identity => ({
  id,
  name: id.toUpperCase(),
  color: "#0f0",
});

beforeEach(() => {
  buses = new Map();
  ioCalls.length = 0;
  ioFactoryInvocations = 0;
});

// TC-004: the socket transport passes the SAME shared contract suite as the
// in-memory transport, run over the mocked (real-protocol) loopback. `room` is
// carried in the handshake `auth.roomId`, so the loopback bus keys rooms apart.
runTransportContract(
  (room, peerId) =>
    createSocketIoTransport({
      url: "wss://test",
      room,
      identity: stubIdentity(peerId),
    }),
  {
    label: "socket.io (mocked loopback, server protocol)",
    beforeEachHook: () => {
      buses = new Map();
    },
  },
);

describe("createSocketIoTransport lazy import + handshake", () => {
  afterEach(() => {
    buses = new Map();
  });

  // socket.io-client not loaded until connect.
  it("does not invoke the io factory until connect() is called", async () => {
    const t = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("a"),
    });
    expect(ioFactoryInvocations).toBe(0);

    await t.connect();

    expect(ioFactoryInvocations).toBe(1);
  });

  // roomId + identity + token flow into handshake auth (server REQUIRES them).
  it("passes roomId, identity and token into the io() handshake auth", async () => {
    const identity = stubIdentity("a");
    const t = createSocketIoTransport({
      url: "wss://test",
      room: "room-7",
      identity,
      token: "jwt",
    });

    await t.connect();

    expect(ioCalls).toHaveLength(1);
    expect(ioCalls[0]?.auth).toEqual({ roomId: "room-7", identity, token: "jwt" });
  });

  // Resolved credentials travel unbroken into the handshake auth.
  it("places resolveIdentity credentials into the io() handshake auth", async () => {
    const identity = stubIdentity("a");
    const creds = await resolveIdentity({ identity, token: "jwt" });
    const t = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      credentials: creds,
    });

    await t.connect();

    expect(ioCalls[0]?.auth).toEqual({ roomId: "r", identity, token: "jwt" });
  });

  // CONNECT/JOIN ORDERING: send() before connect() BUFFERS (never throws), and
  // the buffered message is delivered once connected.
  it("buffers a pre-connect send and delivers it after connect", async () => {
    const a = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("a"),
    });
    const b = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("b"),
    });
    await b.connect();
    const spy = vi.fn();
    b.subscribe(spy);

    // Send on `a` BEFORE connecting — must not throw.
    expect(() => {
      a.send(createMessage(COLAB_EVENTS.POINTER, "a", { x: 1, y: 2 }));
    }).not.toThrow();

    await a.connect();

    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0]?.[0] as ColabMessage).from).toBe("a");
  });

  // A peer interaction (lock) is delivered on the server_interaction channel.
  it("delivers a peer interaction on the server channel", async () => {
    const a = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("a"),
    });
    const b = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("b"),
    });
    await a.connect();
    await b.connect();
    const spy = vi.fn();
    b.subscribe(spy);

    a.send(
      createMessage(COLAB_EVENTS.INTERACTION, "a", {
        name: "lock",
        scopeId: "s" as ColabMessage<"interaction">["payload"]["scopeId"],
      }),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const received = spy.mock.calls[0]?.[0] as ColabMessage;
    expect(received.type).toBe(COLAB_SERVER_EVENTS.INTERACTION);
  });

  it("does not throw when send() is called after disconnect() (buffers)", async () => {
    const t = createSocketIoTransport({
      url: "wss://test",
      room: "r",
      identity: stubIdentity("a"),
    });
    await t.connect();
    await t.disconnect();
    expect(() => {
      t.send(createMessage(COLAB_EVENTS.POINTER, "a", { x: 0, y: 0 }));
    }).not.toThrow();
  });
});
