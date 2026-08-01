/**
 * The example's Socket.IO `ColabTransport`, speaking the DEFAULT
 * `colab-server`'s actual wire protocol.
 *
 * ── WHY THE EXAMPLE SHIPS ITS OWN TRANSPORT (upstream defects, filed to I3/I6) ──
 * The intent of PROJ-T-0047 was to use colab's DEFAULT Socket.IO transport with
 * no wiring. That is not currently possible because the shipped
 * `createSocketIoTransport` and the shipped `createColabServer` do not
 * interoperate:
 *
 *   1. CONNECT/JOIN ORDERING — the provider's `startSession` calls `connect()`
 *      (async) then immediately `joinRoom()` → `transport.send()`, but the
 *      default transport only sets its socket AFTER the async connect resolves,
 *      so `send()` throws `send() called before connect()` and white-screens
 *      the app on mount. (Worked around here by buffering pre-connect sends.)
 *   2. HANDSHAKE `roomId` — the server derives the room + identity from the
 *      socket handshake `auth` (`readJoinRequest` requires `auth.roomId`), but
 *      the default transport's `auth` carries only `identity`/`token`, never
 *      `roomId`, so the server rejects every connection. (Fixed here by putting
 *      `roomId` in the handshake auth.)
 *   3. WIRE EVENT SHAPE — the default transport emits ALL client messages on a
 *      single `colab:msg` event and subscribes only to `colab:msg`, while the
 *      server listens on per-type events (`pointer`/`interaction`) and emits on
 *      per-type events (`roster`, `participant_joined`, `server_pointer`,
 *      `server_interaction`, …). The two never meet. (Bridged here by emitting
 *      client messages on their per-type event and forwarding each server event
 *      back to the core as the `ColabMessage` it already is.)
 *
 * None of this is example domain logic — it is a compatibility shim over the
 * DEFAULT server protocol, to be deleted once the defaults interoperate. It uses
 * only `socket.io-client` (colab-ui's own optional peer) and colab's PUBLIC
 * event/message contracts re-exported for consumers.
 */
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

import type { ColabTransport, Identity } from "colab-ui/react";

type OutboundMessage = Parameters<ColabTransport["send"]>[0];
type InboundHandler = (message: OutboundMessage) => void;

/** Server → client event names the server EMITS on (forwarded to the core). */
const SERVER_EVENTS = [
  "roster",
  "participant_joined",
  "participant_updated",
  "participant_left",
  "server_pointer",
  "server_interaction",
] as const;

export interface DemoTransportOptions {
  url: string;
  room: string;
  identity: Identity;
}

/** Build the example's connect-buffered Socket.IO transport. */
export function createBufferedSocketTransport(
  options: DemoTransportOptions,
): ColabTransport {
  const listeners = new Set<InboundHandler>();
  let socket: Socket | undefined;
  let connected = false;
  const pending: OutboundMessage[] = [];

  const fanOut = (message: OutboundMessage): void => {
    for (const listener of Array.from(listeners)) listener(message);
  };

  const relay = (message: OutboundMessage): void => {
    // The server joins via the handshake, so the core's synthetic `join`
    // message has no server handler — drop it. Everything else routes by type.
    if (message.type === "pointer" || message.type === "interaction") {
      socket?.emit(message.type, message);
    }
  };

  return {
    connect(): Promise<void> {
      const s = io(options.url, {
        transports: ["websocket"],
        auth: { roomId: options.room, identity: options.identity },
      });
      socket = s;
      for (const event of SERVER_EVENTS) {
        s.on(event, (message: OutboundMessage) => {
          fanOut(message);
        });
      }
      return new Promise<void>((resolvePromise) => {
        s.on("connect", () => {
          connected = true;
          while (pending.length > 0) {
            const message = pending.shift();
            if (message !== undefined) relay(message);
          }
          resolvePromise();
        });
      });
    },
    disconnect(): void {
      connected = false;
      pending.length = 0;
      for (const event of SERVER_EVENTS) socket?.off(event);
      socket?.disconnect();
      socket = undefined;
    },
    send(message: OutboundMessage): void {
      if (connected) {
        relay(message);
        return;
      }
      pending.push(message);
    },
    subscribe(handler: InboundHandler): () => void {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}
