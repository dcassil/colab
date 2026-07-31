/**
 * Internal store-key conventions shared by the provider's mirrors and the read
 * hooks. Centralized so a mirror-writer and its hook-reader can never drift.
 *
 * The I2 `Session` keeps its roster and interaction registry as their OWN
 * notifying surfaces (`session.roster.subscribe`, message bus), NOT inside the
 * injected {@link ColabStore}. To let every read hook ride the single
 * `useColabStore`/`useSyncExternalStore` primitive, the provider MIRRORS those
 * surfaces into the store under these stable keys; the hooks then select them.
 * This adds no domain logic — it only projects existing state onto the store
 * seam the binding already owns.
 */

/** Store key holding the current remote roster snapshot (local excluded). */
export const ROSTER_KEY = "colab:roster";

/** Store key prefix for one interaction's reduced state slice. */
export function interactionKey(type: string): string {
  return `colab:interaction:${type}`;
}
