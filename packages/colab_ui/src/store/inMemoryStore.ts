/**
 * `createInMemoryStore` — the default in-memory {@link ColabStore}.
 *
 * The first and smallest I3 seam default: a neutral, framework-free,
 * dependency-free state container that satisfies the I2 {@link ColabStore}
 * interface (`get` / `set` / `subscribe`) VERBATIM. It imports no React, no
 * DOM, and no transport — it loads cleanly in a plain Node/Vitest environment.
 *
 * The I2 `ColabStore` is a KEYED key→value surface (not a single `<S>`
 * snapshot): each string key holds one opaque `unknown` value with its own
 * per-key change subscription. This module adapts the reference-stability
 * contract the task specifies onto that published keyed shape (deferring to the
 * I2 signature, never redefining it):
 *
 *   - REFERENCE STABILITY: `get(key)` returns the current value at `key` by
 *     reference; two consecutive `get(key)` calls with no intervening `set`
 *     return the identical reference (`Object.is` true).
 *   - CHANGE GATE: `set(key, value)` notifies that key's listeners ONLY when
 *     the value reference actually changes. If the next value is `Object.is`-
 *     equal to the current value at `key`, NO listener is invoked and `get(key)`
 *     continues to return the same reference.
 *   - SYNCHRONOUS NOTIFY: on change, all currently-registered listeners for
 *     that key are invoked synchronously (before `set` returns), exactly once.
 *   - SAFE ITERATION: notification iterates a snapshot of the listener set, so
 *     a listener that (un)subscribes during the pass cannot corrupt iteration.
 *   - IDEMPOTENT UNSUBSCRIBE: the returned unsubscribe closure is safe to call
 *     more than once (`Set.delete` is inherently idempotent).
 *
 * The store is value-shape-agnostic: it never deep-clones and knows nothing
 * about rosters / presence / interactions — those compose above it.
 */
import type { ColabStore } from "../contracts/store.js";

/** Build a default in-memory {@link ColabStore} backed by plain `Map`s. */
export function createInMemoryStore(): ColabStore {
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();

  function notify(key: string): void {
    const set = listeners.get(key);
    if (set === undefined) return;
    // Iterate a snapshot so (un)subscribe during the pass cannot corrupt it.
    for (const listener of Array.from(set)) listener();
  }

  return {
    get(key) {
      return values.get(key);
    },

    set(key, value) {
      // Reference-stability gate: no-op (and no notify) when unchanged. An
      // unset key holds `undefined`, so `set(k, undefined)` on a fresh key is
      // correctly treated as a no-op.
      if (Object.is(values.get(key), value)) return;
      values.set(key, value);
      notify(key);
    },

    subscribe(key, listener) {
      let set = listeners.get(key);
      if (set === undefined) {
        set = new Set<() => void>();
        listeners.set(key, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}
