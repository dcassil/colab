/**
 * `usePresence` — the roster hook: the current REMOTE participants.
 *
 * Reads the roster slice the provider mirrors into the store (see
 * `sessionLifecycle`'s `mirrorRoster` + {@link ROSTER_KEY}) through the shared
 * {@link useColabStore} primitive with a MODULE-LEVEL selector, so `getSnapshot`
 * identity is stable and the primitive's snapshot cache keeps the returned array
 * referentially stable while the roster is unchanged.
 *
 * LOCAL EXCLUSION: per I2 roster semantics the local participant never enters
 * its own roster (the roster is populated from inbound server participant
 * events, not from the local join), so the mirrored snapshot already contains
 * only remotes — no in-hook filtering is needed, which also preserves the
 * snapshot-caching guarantee.
 *
 * Re-renders exactly once on a join or leave and NOT on unrelated slices (e.g.
 * an interaction update), because the primitive is scoped to the roster key.
 * Uses the same outside-provider guard as every other hook.
 */
import type { Participant } from "colab-protocol";

import { ROSTER_KEY } from "./storeKeys.js";
import { useColabStore } from "./useColabStore.js";

/** Stable empty roster returned before the first mirror primes the key. */
const EMPTY: readonly Participant[] = Object.freeze([]);

/** Module-level, stable selector: the mirrored remote-roster snapshot. */
function selectRoster(raw: unknown): readonly Participant[] {
  return (raw as readonly Participant[] | undefined) ?? EMPTY;
}

/**
 * Return the current remote participants (local excluded). Referentially stable
 * while the roster is unchanged; re-renders only on join/leave.
 */
export function usePresence(): readonly Participant[] {
  return useColabStore(ROSTER_KEY, selectRoster);
}
