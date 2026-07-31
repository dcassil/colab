/**
 * `useColabStore` — the shared subscription primitive every read hook rides on.
 *
 * Binds one keyed slice of the session's I2 {@link ColabStore} to React via
 * `useSyncExternalStore`, the React-sanctioned primitive for external stores
 * (tear-free, Strict-Mode-safe, concurrent-safe). Correctness rests on three
 * stable references required by React:
 *
 *   - SUBSCRIBE: a `useCallback`-memoized `(cb) => store.subscribe(key, cb)`
 *     so the subscription identity is stable across renders (it changes only
 *     when the store or key changes).
 *   - GET SNAPSHOT: a memoized reader that caches the last `(rawInput → output)`
 *     pair. The store guarantees a stable reference for an unchanged slice, so
 *     the cache recomputes the selector ONLY when the raw slice reference
 *     actually changes — a notification that leaves the slice untouched yields
 *     the identical snapshot reference and triggers NO re-render. This holds
 *     even for selectors that derive fresh objects, satisfying React's
 *     "getSnapshot must be cached" rule and preventing infinite loops.
 *   - SERVER SNAPSHOT: the same reader doubles as `getServerSnapshot`, so the
 *     hook is SSR-safe.
 *
 * The store is derived from the active session on context; calling this hook
 * outside a `<ColabProvider>` throws the same descriptive provider-missing error
 * as every other hook. This module is INTERNAL — not re-exported publicly.
 *
 * CALLER CONTRACT: `selector` must be referentially stable (module-level or
 * `useCallback`) so `getSnapshot` identity stays stable; the derived hooks
 * (T5/T6) supply module-level selectors.
 */
import { useCallback, useRef, useSyncExternalStore } from "react";

import { useColabContextValue } from "./useColabContext.js";

/** Sentinel marking an un-primed cache (distinct from any real slice value). */
const UNSET = Symbol("useColabStore.unset");

interface SnapshotCache<T> {
  input: unknown;
  output: T;
  primed: boolean;
}

/**
 * Subscribe to the `key` slice of the session store, projecting it through
 * `selector`. Re-renders only when the selected output changes.
 */
export function useColabStore<T>(
  key: string,
  selector: (raw: unknown) => T,
): T {
  const { store } = useColabContextValue("useColabStore");

  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe(key, onChange),
    [store, key],
  );

  const cacheRef = useRef<SnapshotCache<T>>({
    input: UNSET,
    output: undefined as T,
    primed: false,
  });

  const getSnapshot = useCallback((): T => {
    const raw = store.get(key);
    const cache = cacheRef.current;
    // Recompute only when the raw slice reference changed (the store keeps an
    // unchanged slice referentially stable), keeping derived outputs cached.
    if (!cache.primed || !Object.is(cache.input, raw)) {
      cache.input = raw;
      cache.output = selector(raw);
      cache.primed = true;
    }
    return cache.output;
  }, [store, key, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
