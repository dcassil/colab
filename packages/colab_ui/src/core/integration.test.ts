import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import { createEchoHub } from "../__tests__/echo-hub.js";
import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import { createMessageBus } from "./bus.js";
import { createSession } from "./session.js";

const alice: Identity = { id: "alice", name: "Alice", color: "#f00" };

describe("Two-session compose-through-interfaces (TC-001)", () => {
  it("relays a pointer A→B clone-safe and converges B's roster", () => {
    const hub = createEchoHub();
    const store = createFakeStore();
    const a = createSession({ transport: hub.connectTransport(), store });
    const b = createSession({ transport: hub.connectTransport(), store });

    const received: ColabMessage[] = [];
    b.bus.subscribe(COLAB_EVENTS.POINTER, (m) => received.push(m));

    void a.connect();
    void b.connect();
    void a.joinRoom("room", alice);

    // B's roster reflects A's join (client JOIN → server PARTICIPANT_JOINED).
    expect(b.roster.getParticipants().map((p) => p.id)).toEqual(["alice"]);

    const outgoing = createMessage(COLAB_EVENTS.POINTER, "alice", {
      x: 0.3,
      y: 0.6,
    });
    a.bus.publish(outgoing);

    // Arrived on B, deep-equal across the structuredClone boundary...
    expect(received).toHaveLength(1);
    expect(received[0]).toStrictEqual(outgoing);
    // ...and is a distinct reference (proving it crossed the clone boundary).
    expect(received[0]).not.toBe(outgoing);

    void a.disconnect();
    expect(b.roster.getParticipants()).toHaveLength(0);
  });
});

describe("Session disconnect cleanup via fakes (TC-002)", () => {
  it("tears down subscription so post-disconnect inbound reaches no handler", () => {
    const transport = createFakeTransport();
    const session = createSession({ transport, store: createFakeStore() });
    const spy = vi.fn();
    session.bus.subscribe(COLAB_SERVER_EVENTS.POINTER, spy);

    void session.connect();
    void session.joinRoom("room", alice);
    session.roster.applyJoin(alice);

    void session.disconnect();
    expect(transport.disconnectCalls()).toBe(1);
    expect(session.roster.getParticipants()).toHaveLength(0);
    expect(transport.hasSubscriber()).toBe(false);

    // Emit after disconnect: the fake has no subscriber, nothing is delivered.
    transport.emit(createMessage(COLAB_SERVER_EVENTS.POINTER, "peer", { x: 1, y: 1 }));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("MessageBus publish is O(handlers-for-type)", () => {
  it("invokes only the matching type's handlers", () => {
    const bus = createMessageBus();
    const pointer = vi.fn();
    const others = [
      COLAB_EVENTS.INTERACTION,
      COLAB_EVENTS.JOIN,
      COLAB_EVENTS.UPDATE,
      COLAB_EVENTS.LEAVE,
    ].map((type) => {
      const h = vi.fn();
      bus.subscribe(type, h);
      return h;
    });
    bus.subscribe(COLAB_EVENTS.POINTER, pointer);

    bus.publish(createMessage(COLAB_EVENTS.POINTER, "u", { x: 0, y: 0 }));

    expect(pointer).toHaveBeenCalledTimes(1);
    for (const h of others) expect(h).not.toHaveBeenCalled();
  });
});
