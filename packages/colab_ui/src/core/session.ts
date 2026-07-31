import { COLAB_EVENTS } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import type { ColabStore } from "../contracts/store.js";
import type { ColabTransport } from "../contracts/transport.js";
import { createMessageBus } from "./bus.js";
import type { MessageBus } from "./bus.js";
import { createInteractionRegistry } from "./registry.js";
import type { InteractionRegistry } from "./registry.js";
import { createRoster } from "./roster.js";
import type { Roster } from "./roster.js";
import { isRosterEvent, routeToRoster } from "./routing.js";

/** Dependencies injected into a {@link Session}: only the T2 seam interfaces. */
export interface SessionDeps {
  transport: ColabTransport;
  store: ColabStore;
}

/**
 * `Session` — the lifecycle orchestrator wiring the two seams
 * ({@link ColabTransport}, {@link ColabStore}) to the core primitives
 * ({@link MessageBus}, {@link Roster}, {@link InteractionRegistry}).
 *
 * The `bus`, `roster`, and `registry` are OWNED (created internally) and
 * exposed read-only so I4 can subscribe and I5 can register. The session holds
 * only the seam interfaces — never a concrete transport/store — which is what
 * proves the seams are real (defaults ship in I3, server in I6).
 */
export interface Session {
  readonly bus: MessageBus;
  readonly roster: Roster;
  readonly registry: InteractionRegistry;
  /** Open the transport and start routing inbound messages. */
  connect(): Promise<void> | void;
  /**
   * Announce joining `room` as `identity`. `token` is forwarded to the
   * transport for auth but never stored on `Identity` (auth seam is out of I2
   * scope beyond this parameter).
   */
  joinRoom(room: string, identity: Identity, token?: string): Promise<void> | void;
  /** Remove the local participant, tear down subscriptions, close transport. */
  disconnect(): Promise<void> | void;
}

/**
 * Create a {@link Session}.
 *
 * OWNERSHIP: the bus/roster/registry are created internally (not injectable) —
 * they are implementation detail the session fully controls; only the two
 * external seams are injected.
 *
 * ECHO AVOIDANCE: the outbound relay forwards to `transport.send` only messages
 * whose `from` equals the local participant id, so inbound messages re-published
 * onto the bus are never bounced back to the transport.
 */
export function createSession({ transport, store }: SessionDeps): Session {
  void store; // Reserved for I4 binding; the session owns no store state in I2.
  const bus = createMessageBus();
  const roster = createRoster();
  const registry = createInteractionRegistry();

  let localId: string | undefined;
  let unsubscribeInbound: (() => void) | undefined;

  function inbound(message: ColabMessage): void {
    if (isRosterEvent(message)) {
      routeToRoster(roster, message);
    } else {
      bus.publish(message);
    }
  }

  // Outbound relay: local publishes (from === localId) go to the transport.
  bus.subscribe(COLAB_EVENTS.POINTER, relayIfLocal);
  bus.subscribe(COLAB_EVENTS.INTERACTION, relayIfLocal);

  function relayIfLocal(message: ColabMessage): void {
    if (localId !== undefined && message.from === localId) {
      transport.send(message);
    }
  }

  function connect(): Promise<void> | void {
    const result = transport.connect();
    unsubscribeInbound = transport.subscribe(inbound);
    return result;
  }

  function joinRoom(
    room: string,
    identity: Identity,
    token?: string,
  ): Promise<void> | void {
    void room;
    void token;
    localId = identity.id;
    transport.send({
      type: COLAB_EVENTS.JOIN,
      from: identity.id,
      payload: identity,
    });
  }

  function disconnect(): Promise<void> | void {
    if (localId !== undefined) roster.applyLeave(localId);
    unsubscribeInbound?.();
    unsubscribeInbound = undefined;
    bus.clear();
    localId = undefined;
    return transport.disconnect();
  }

  return { bus, roster, registry, connect, joinRoom, disconnect };
}
