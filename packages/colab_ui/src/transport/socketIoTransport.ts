/**
 * `createSocketIoTransport` — the default flagship "battery" transport.
 *
 * Satisfies the I2 {@link ColabTransport} interface (`connect` / `disconnect` /
 * `send` / `subscribe`) VERBATIM and makes the one-line happy path connect to
 * the DEFAULT `colab-server` out of the box. It speaks the server's REAL wire
 * protocol (see `colab_server/src/relay.ts`):
 *
 *   - JOIN is via the socket.io handshake `auth` ({@link SocketAuth}) carrying
 *     `roomId` + `identity` (+ optional `token`). `readJoinRequest` on the
 *     server REQUIRES `roomId` and `identity`, so both MUST be in `auth` or the
 *     connection is rejected. There is NO client "join" event.
 *   - OUTBOUND client messages are emitted on PER-TYPE channels
 *     ({@link COLAB_EVENTS} `pointer` / `interaction` / `update` / `leave`),
 *     never a single `colab:msg` event. The core's synthetic `join` envelope
 *     has no server handler (join is the handshake) and is dropped.
 *   - INBOUND server messages arrive on the {@link COLAB_SERVER_EVENTS}
 *     channels (`roster`, `participant_joined/updated/left`, `server_pointer`,
 *     `server_interaction`). Each is already a well-formed {@link ColabMessage}
 *     built by the server's `createMessage`, so it is fanned out to subscribers
 *     verbatim; the core routes roster events to the roster and peer
 *     pointer/interaction events to the bus.
 *
 * CONNECT/JOIN ORDERING: `send()` NEVER throws. Messages sent before the socket
 * has finished connecting are buffered and flushed on `connect`, so the
 * provider's connect→join→send sequence works even though `connect()` resolves
 * asynchronously. This is Strict-Mode-safe: a `disconnect()` before connect
 * settles clears the buffer and drops the socket.
 *
 * LOAD-BEARING CONSTRAINT — LAZY OPTIONAL DEPENDENCY: `socket.io-client` is
 * loaded ONLY via `await import("socket.io-client")` inside `connect()`. There
 * is NO top-level `import ... from "socket.io-client"` anywhere — not even a
 * type-only import — so no core-barrel-reachable file has a static edge to it.
 * A depcruise rule (`no-socketio-from-core-barrel`) plus a graph-scan test
 * prove this, so bundlers tree-shake socket.io out for consumers who bring
 * their own transport. This module structurally types the socket it needs
 * (never importing socket.io's types) to keep even the type graph socket-free.
 */
import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import type { ColabTransport } from "../contracts/transport.js";
import type { ColabCredentials } from "../identity/identityProvider.js";

/** The handshake `auth` payload placed in the socket.io connection options. */
export interface SocketAuth {
  /** Room the server joins this socket to (required by `readJoinRequest`). */
  roomId: string;
  /** Self-asserted identity, for roster attribution (required by the server). */
  identity: Identity;
  /** Opaque credential verified by the server (ignored by loopback transports). */
  token?: string;
}

/** Options for {@link createSocketIoTransport}. */
export interface SocketIoTransportOptions {
  /** Server URL to connect to (e.g. "https://colab.example.com"). */
  url: string;
  /** Room to join via the handshake. Defaults to "default". */
  room?: string;
  /**
   * Resolved credentials (the shared {@link ColabCredentials} shape produced by
   * the identity path's `resolveIdentity`). When present, its `identity`/`token`
   * populate the handshake `auth`, taking precedence over the loose
   * `identity`/`token` fields below.
   */
  credentials?: ColabCredentials;
  /** Self-asserted identity; carried into the handshake `auth`. */
  identity?: Identity;
  /** Credential; carried into the handshake `auth` (server-verified). */
  token?: string;
}

/** Minimal structural view of a socket.io client socket (no type import). */
interface SocketLike {
  on(event: string, handler: (payload: unknown) => void): void;
  off(event?: string): void;
  emit(event: string, ...args: unknown[]): void;
  disconnect(): void;
}

/** The `io(url, opts)` factory shape we consume from the dynamic import. */
type IoFactory = (
  url: string,
  opts: { auth: SocketAuth; transports?: string[] },
) => SocketLike;

/** Server → client event names the server EMITS on (forwarded to the core). */
const SERVER_EVENTS: readonly string[] = [
  COLAB_SERVER_EVENTS.ROSTER,
  COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
  COLAB_SERVER_EVENTS.PARTICIPANT_UPDATED,
  COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
  COLAB_SERVER_EVENTS.POINTER,
  COLAB_SERVER_EVENTS.INTERACTION,
];

/**
 * Build the handshake `auth`. Resolved `credentials` (from the identity path)
 * win over the loose fields. `roomId` is always present; `identity` MUST be —
 * the server rejects a handshake missing either.
 */
function buildAuth(opts: SocketIoTransportOptions, room: string): SocketAuth {
  const identity = opts.credentials?.identity ?? opts.identity;
  if (identity === undefined) {
    throw new Error(
      "SocketIoTransport: an identity is required (via `identity` or resolved `credentials`) — the default server rejects a handshake without one.",
    );
  }
  const token = opts.credentials?.token ?? opts.token;
  const auth: SocketAuth = { roomId: room, identity };
  if (token !== undefined) auth.token = token;
  return auth;
}

/**
 * Map a core envelope onto the server's per-type client channel and emit it.
 * The synthetic `join` envelope has no server handler (join is the handshake),
 * so it is dropped. All other client message types route by their `type`.
 */
function relay(socket: SocketLike, message: ColabMessage): void {
  switch (message.type) {
    case COLAB_EVENTS.POINTER:
    case COLAB_EVENTS.INTERACTION:
    case COLAB_EVENTS.UPDATE:
    case COLAB_EVENTS.LEAVE:
      socket.emit(message.type, message);
      return;
    default:
      // `join` (and any future non-relayed type) — the server joins via the
      // handshake, so there is nothing to emit.
      return;
  }
}

/** Build the default Socket.IO {@link ColabTransport}. */
export function createSocketIoTransport(
  opts: SocketIoTransportOptions,
): ColabTransport {
  const room = opts.room ?? "default";
  const listeners = new Set<(message: ColabMessage) => void>();
  let socket: SocketLike | undefined;
  let connected = false;
  const pending: ColabMessage[] = [];

  function fanOut(message: ColabMessage): void {
    for (const listener of Array.from(listeners)) listener(message);
  }

  return {
    async connect() {
      // LAZY OPTIONAL IMPORT — the sole reference to socket.io-client, reached
      // only at runtime on first connect, never statically from any barrel.
      const mod = (await import("socket.io-client")) as unknown as {
        io: IoFactory;
      };
      const s = mod.io(opts.url, {
        auth: buildAuth(opts, room),
        transports: ["websocket"],
      });
      socket = s;
      for (const event of SERVER_EVENTS) {
        s.on(event, (payload) => {
          fanOut(payload as ColabMessage);
        });
      }
      await new Promise<void>((resolve) => {
        s.on("connect", () => {
          connected = true;
          while (pending.length > 0) {
            const message = pending.shift();
            if (message !== undefined) relay(s, message);
          }
          resolve();
        });
      });
    },

    disconnect() {
      connected = false;
      pending.length = 0;
      if (socket === undefined) return;
      for (const event of SERVER_EVENTS) socket.off(event);
      socket.off("connect");
      socket.disconnect();
      socket = undefined;
      listeners.clear();
    },

    send(message) {
      // Never throws: buffer pre-connect sends so the provider's
      // connect→join→send sequence works despite async connect resolution.
      if (connected && socket !== undefined) {
        relay(socket, message);
        return;
      }
      pending.push(message);
    },

    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}
