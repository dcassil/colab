/**
 * `hub` — an in-process, room-keyed fan-out backbone for loopback transports.
 *
 * The deterministic substrate under {@link createInMemoryTransport}: a tiny,
 * framework-free registry mapping a room name to the set of listeners attached
 * to it. `broadcast` delivers an envelope to every listener in a room EXCEPT
 * the originating one (no self-echo — matching the roster/EchoHub contract,
 * where a peer never receives its own broadcast). It carries no DOM, no React,
 * and no protocol assumptions beyond passing envelopes opaquely.
 *
 * A `Hub` instance owns its own room registry, so tests can spin up an isolated
 * hub; a shared process-default hub is exported as {@link defaultHub} for peers
 * that opt into the no-server in-process path without naming a hub explicitly.
 */
import type { ColabMessage } from "colab-protocol";

/** A hub listener receives one broadcast envelope. */
export type HubListener = (message: ColabMessage) => void;

/** An in-process, room-keyed envelope fan-out registry. */
export interface Hub {
  /**
   * Attach `listener` to `room`.
   *
   * @returns an idempotent detach closure that removes exactly this listener
   *   and prunes the room's set once empty (so no leaked listeners remain).
   */
  attach(room: string, listener: HubListener): () => void;
  /**
   * Broadcast `message` to every listener in `room` except `from` (the
   * originating listener), preserving the no-self-echo contract.
   */
  broadcast(room: string, message: ColabMessage, from?: HubListener): void;
  /**
   * Number of listeners currently attached to `room` (0 if the room is
   * absent). Exposed for leak assertions in tests.
   */
  listenerCount(room: string): number;
}

/** Build an isolated {@link Hub} with its own room registry. */
export function createHub(): Hub {
  const rooms = new Map<string, Set<HubListener>>();

  return {
    attach(room, listener) {
      let set = rooms.get(room);
      if (set === undefined) {
        set = new Set<HubListener>();
        rooms.set(room, set);
      }
      set.add(listener);
      return () => {
        const current = rooms.get(room);
        if (current === undefined) return;
        current.delete(listener);
        if (current.size === 0) rooms.delete(room);
      };
    },

    broadcast(room, message, from) {
      const set = rooms.get(room);
      if (set === undefined) return;
      // Snapshot so (de)registration during delivery cannot corrupt iteration.
      for (const listener of Array.from(set)) {
        if (listener === from) continue;
        listener(message);
      }
    },

    listenerCount(room) {
      return rooms.get(room)?.size ?? 0;
    },
  };
}

/**
 * The process-default shared {@link Hub}. Peers that select the in-process
 * loopback path without naming a hub fan out through this instance, so
 * same-process peers/tests converge with no server and no network.
 */
export const defaultHub: Hub = createHub();
