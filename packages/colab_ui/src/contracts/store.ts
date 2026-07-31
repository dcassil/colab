/**
 * `ColabStore` — the seam between the core and a state manager.
 *
 * DECLARED CONTRACT ONLY. No concrete implementation ships from I2. I3 provides
 * store adapters over external managers (Zustand / Redux / Jotai / valtio); the
 * core reads and writes presence/interaction state exclusively through this
 * thin keyed façade so it never depends on a particular state library.
 *
 * The store is a keyed key→value surface with per-key change subscription.
 * Keys are plain strings; values are opaque to the store.
 *
 * Reads/writes are typed `unknown` rather than a per-call generic `<T>`: a
 * dynamic string-keyed bag cannot *prove* the value at a key matches a
 * caller-supplied `T`, so a `get<T>` would be an unchecked cast dressed as
 * type safety. Callers narrow the returned `unknown` at the boundary (e.g.
 * `store.get(k) as Roster`), keeping the seam honest and thin so any external
 * manager (Zustand / Redux / Jotai / valtio) can back it.
 */
export interface ColabStore {
  /** Read the value at `key`, or `undefined` if unset. */
  get(key: string): unknown;
  /** Write `value` at `key`, notifying that key's listeners. */
  set(key: string, value: unknown): void;
  /**
   * Subscribe to changes at `key`.
   *
   * @returns an unsubscribe closure that detaches the listener.
   */
  subscribe(key: string, listener: () => void): () => void;
}
