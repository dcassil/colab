import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "colab-protocol";
import type { ColabMessage, Participant } from "colab-protocol";

import type { ColabTransport } from "../contracts/transport.js";

const clone = (globalThis as unknown as {
  structuredClone: <T>(value: T) => T;
}).structuredClone;

/**
 * `EchoHub` — a minimal in-memory stand-in for the I6 relay, used only by the
 * integration test. It connects several {@link ColabTransport}s and, on each
 * `send`, forwards a `structuredClone`d copy to every OTHER connected peer,
 * exercising the real serialization boundary under composition.
 *
 * It performs the same client→server translation a real relay would, so a
 * peer's `Roster` (which reacts only to `COLAB_SERVER_EVENTS`) converges:
 *  - a client `JOIN` (Identity) becomes a server `PARTICIPANT_JOINED`,
 *  - a transport `disconnect` after a known join becomes `PARTICIPANT_LEFT`.
 * Non-lifecycle messages (pointer/interaction) are relayed as-is.
 */
export interface EchoHub {
  /** Create a transport wired into this hub. */
  connectTransport(): ColabTransport;
}

interface Peer {
  handler: ((message: ColabMessage) => void) | undefined;
  localId: string | undefined;
}

export function createEchoHub(): EchoHub {
  const peers = new Set<Peer>();

  function deliver(from: Peer, message: ColabMessage): void {
    for (const peer of peers) {
      if (peer === from) continue;
      peer.handler?.(clone(message));
    }
  }

  function relay(from: Peer, message: ColabMessage): void {
    if (message.type === COLAB_EVENTS.JOIN) {
      from.localId = message.payload.id;
      deliver(from, {
        type: COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
        from: message.from,
        payload: message.payload satisfies Participant,
      });
      return;
    }
    deliver(from, message);
  }

  function connectTransport(): ColabTransport {
    const peer: Peer = { handler: undefined, localId: undefined };
    return {
      connect: () => void peers.add(peer),
      disconnect: () => {
        if (peer.localId !== undefined) {
          deliver(peer, {
            type: COLAB_SERVER_EVENTS.PARTICIPANT_LEFT,
            from: peer.localId,
            payload: { id: peer.localId },
          });
        }
        peers.delete(peer);
      },
      send: (message) => {
        relay(peer, message);
      },
      subscribe: (handler) => {
        peer.handler = handler;
        return () => {
          peer.handler = undefined;
        };
      },
    };
  }

  return { connectTransport };
}
