/**
 * `createInMemoryTransport` — the default no-server "loopback" transport.
 *
 * Satisfies the I2 {@link ColabTransport} interface (`connect` / `disconnect` /
 * `send` / `subscribe`) VERBATIM. It is a legitimate no-server default and the
 * deterministic substrate for all I3 transport testing:
 *
 *   - When a `BroadcastChannel` global exists AND a `channelName` is provided,
 *     same-origin tabs talk over that channel (feature-detected — the module
 *     loads and runs in Node/Vitest where `BroadcastChannel` is absent).
 *   - Otherwise peers fan out through the in-process {@link Hub} (default:
 *     {@link defaultHub}), so same-process peers/tests converge with no network.
 *
 * SELF-ECHO CONTRACT: `send` delivers to every OTHER peer in the room, never
 * back to the sender (matching the roster/EchoHub contract). The contract test
 * suite encodes this choice.
 *
 * AUTH: `identity` is carried on the transport for roster attribution; `token`
 * is accepted but IGNORED on loopback — there is no server to verify against.
 */
import type { ColabMessage, Identity } from "colab-protocol";

import type { ColabTransport } from "../contracts/transport.js";

import { defaultHub, type Hub, type HubListener } from "./hub.js";

/** Options for {@link createInMemoryTransport}. */
export interface InMemoryTransportOptions {
  /** Room key; peers sharing a room exchange envelopes. Defaults to "default". */
  room?: string;
  /** Self-asserted identity, carried for roster attribution. */
  identity?: Identity;
  /** Ignored on loopback (no server to verify) — documented, not used. */
  token?: string;
  /**
   * When set AND a `BroadcastChannel` global exists, use that channel instead
   * of the in-process hub. Absent/unsupported → in-process hub fallback.
   */
  channelName?: string;
  /** Override the in-process hub (tests inject an isolated hub). */
  hub?: Hub;
}

/** Minimal structural view of the `BroadcastChannel` API this transport uses. */
interface ChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

type ChannelCtor = new (name: string) => ChannelLike;

function resolveChannel(name: string | undefined): ChannelLike | undefined {
  if (name === undefined) return undefined;
  // Read the constructor structurally via `unknown` so this stays correct
  // whether or not an ambient `BroadcastChannel` global type is in scope, and
  // whether or not the runtime actually provides one (feature detection).
  const ctor = (globalThis as unknown as { BroadcastChannel?: ChannelCtor })
    .BroadcastChannel;
  if (ctor === undefined) return undefined;
  return new ctor(name);
}

/** Build a loopback {@link ColabTransport} over a hub or `BroadcastChannel`. */
export function createInMemoryTransport(
  opts: InMemoryTransportOptions = {},
): ColabTransport {
  const room = opts.room ?? "default";
  const hub = opts.hub ?? defaultHub;
  const listeners = new Set<(message: ColabMessage) => void>();

  let channel: ChannelLike | undefined;
  let detach: (() => void) | undefined;

  function fanOut(message: ColabMessage): void {
    for (const listener of Array.from(listeners)) listener(message);
  }

  const hubListener: HubListener = (message) => {
    fanOut(message);
  };

  return {
    connect() {
      channel = resolveChannel(opts.channelName);
      if (channel !== undefined) {
        channel.onmessage = (event) => {
          fanOut(event.data as ColabMessage);
        };
      } else {
        detach = hub.attach(room, hubListener);
      }
      return Promise.resolve();
    },

    disconnect() {
      if (channel !== undefined) {
        channel.onmessage = null;
        channel.close();
        channel = undefined;
      }
      detach?.();
      detach = undefined;
      listeners.clear();
      return Promise.resolve();
    },

    send(message) {
      if (channel !== undefined) {
        // BroadcastChannel does not echo to the posting context — matches the
        // no-self-echo contract natively.
        channel.postMessage(message);
        return;
      }
      hub.broadcast(room, message, hubListener);
    },

    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
}
