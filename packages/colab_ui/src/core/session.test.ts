import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import { createSession } from "./session.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };
const peer = { id: "peer", name: "Peer", color: "#000" };

describe("Session connect + inbound routing (TC-001)", () => {
  it("routes lifecycle to roster and other messages to the bus", () => {
    const transport = createFakeTransport();
    const session = createSession({ transport, store: createFakeStore() });

    void session.connect();
    expect(transport.connectCalls()).toBe(1);
    expect(transport.hasSubscriber()).toBe(true);

    transport.emit(
      createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, "peer", peer),
    );
    // A non-lifecycle (server pointer) message must not touch the roster.
    transport.emit(createMessage(COLAB_SERVER_EVENTS.POINTER, "peer", { x: 1, y: 2 }));

    expect(session.roster.getParticipants().map((p) => p.id)).toEqual(["peer"]);
    expect(session.roster.getParticipants()).toHaveLength(1);
  });

  it("publishes non-lifecycle inbound messages onto the bus", () => {
    const transport = createFakeTransport();
    const session = createSession({ transport, store: createFakeStore() });
    const spy = vi.fn();
    session.bus.subscribe(COLAB_SERVER_EVENTS.POINTER, spy);
    void session.connect();

    transport.emit(createMessage(COLAB_SERVER_EVENTS.POINTER, "peer", { x: 1, y: 2 }));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("Session outbound relay + disconnect cleanup (TC-002)", () => {
  it("relays local publishes to the transport and tears down on disconnect", () => {
    const transport = createFakeTransport();
    const session = createSession({ transport, store: createFakeStore() });
    void session.connect();
    void session.joinRoom("room-1", identity, "tok");

    // join message was sent to the transport
    expect(transport.sent.map((m) => m.type)).toContain(COLAB_EVENTS.JOIN);

    session.bus.publish(createMessage(COLAB_EVENTS.POINTER, "me", { x: 0.1, y: 0.2 }));
    expect(transport.sent.some((m) => m.type === COLAB_EVENTS.POINTER)).toBe(true);

    session.roster.applyJoin(identity);
    void session.disconnect();

    expect(session.roster.getParticipants()).toHaveLength(0);
    expect(transport.hasSubscriber()).toBe(false);
    expect(transport.disconnectCalls()).toBe(1);
  });

  it("does NOT relay inbound (non-local) messages back to the transport", () => {
    const transport = createFakeTransport();
    const session = createSession({ transport, store: createFakeStore() });
    void session.connect();
    void session.joinRoom("room-1", identity);
    const sentBefore = transport.sent.length;

    // An inbound peer pointer published on the bus must not echo to transport.
    session.bus.publish(createMessage(COLAB_EVENTS.POINTER, "peer", { x: 9, y: 9 }));

    expect(transport.sent.length).toBe(sentBefore);
  });
});
