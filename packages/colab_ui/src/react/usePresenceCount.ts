import { usePresence } from "./usePresence.js";

/**
 * Return the number of other participants currently present.
 *
 * `usePresence` is already remote-only in the normal provider flow; the explicit
 * self filter keeps this helper correct for custom stores or replayed rosters
 * that may include the local participant.
 */
export function usePresenceCount(selfId: string): number {
  return usePresence().filter((participant) => participant.id !== selfId).length;
}
