/**
 * `createSocketIoTransport` — the default flagship "battery" transport.
 *
 * Satisfies the I2 {@link ColabTransport} interface (`connect` / `disconnect` /
 * `send` / `subscribe`) VERBATIM and makes the one-line happy path connect to
 * `colab_server` out of the box. It maps colab wire envelopes onto a thin
 * socket.io event surface (`colab:msg` + lifecycle `join` / `leave`).
 *
 * LOAD-BEARING CONSTRAINT — LAZY OPTIONAL DEPENDENCY: `socket.io-client` is
 * loaded ONLY via `await import("socket.io-client")` inside `connect()`. There
 * is NO top-level `import ... from "socket.io-client"` anywhere — not even a
 * type-only import — so no core-barrel-reachable file has a static edge to it.
 * A depcruise rule (`no-socketio-from-core-barrel`) plus a graph-scan test
 * prove this, so bundlers tree-shake socket.io out for consumers who bring
 * their own transport. This module structurally types the socket it needs
 * (never importing socket.io's types) to keep even the type graph socket-free.
 *
 * The I2 `ColabTransport.connect()` is nullary, so connection config (url,
 * identity, token, room) is supplied to the FACTORY; `connect()` reads it when
 * it builds the socket. The resolved `{ identity, token }` (threaded by T4's
 * identity path) lands in the socket.io handshake `auth` object.
 */
import type { ColabMessage, Identity } from "colab-protocol";

import type { ColabTransport } from "../contracts/transport.js";

/** The handshake `auth` payload placed in the socket.io connection options. */
export interface SocketAuth {
  /** Self-asserted identity, for roster attribution. */
  identity?: Identity;
  /** Opaque credential verified by the server (ignored by loopback transports). */
  token?: string;
}

/** Options for {@link createSocketIoTransport}. */
export interface SocketIoTransportOptions {
  /** Server URL to connect to (e.g. "https://colab.example.com"). */
  url: string;
  /** Room to join after the socket connects. Defaults to "default". */
  room?: string;
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
  opts: { auth: SocketAuth },
) => SocketLike;

/** The colab wire event carrying every envelope over the socket. */
const MSG_EVENT = "colab:msg";

function buildAuth(opts: SocketIoTransportOptions): SocketAuth {
  const auth: SocketAuth = {};
  if (opts.identity !== undefined) auth.identity = opts.identity;
  if (opts.token !== undefined) auth.token = opts.token;
  return auth;
}

/** Build the default Socket.IO {@link ColabTransport}. */
export function createSocketIoTransport(
  opts: SocketIoTransportOptions,
): ColabTransport {
  const room = opts.room ?? "default";
  const listeners = new Set<(message: ColabMessage) => void>();
  let socket: SocketLike | undefined;

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
      const s = mod.io(opts.url, { auth: buildAuth(opts) });
      socket = s;
      await new Promise<void>((resolve) => {
        s.on("connect", () => {
          resolve();
        });
      });
      s.on(MSG_EVENT, (payload) => {
        fanOut(payload as ColabMessage);
      });
      s.emit("join", room);
    },

    disconnect() {
      if (socket === undefined) return;
      socket.emit("leave", room);
      socket.off(MSG_EVENT);
      socket.off("connect");
      socket.disconnect();
      socket = undefined;
      listeners.clear();
    },

    send(message) {
      if (socket === undefined) {
        throw new Error(
          "SocketIoTransport: send() called before connect() (or after disconnect()).",
        );
      }
      socket.emit(MSG_EVENT, message);
    },

    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}
