import type { Participant } from "colab-protocol";

/**
 * `Roster` — the live set of {@link Participant}s maintained from inbound
 * join / update / leave events.
 *
 * Framework-neutral: change notification is a plain listener set, not React
 * state. The session (T6) feeds server lifecycle events into the `apply*`
 * mutators; the React binding (I4) subscribes to render presence.
 */
export interface Roster {
  /**
   * Add a participant. Idempotent: a join for an existing id replaces that
   * entry rather than duplicating it.
   */
  applyJoin(participant: Participant): void;
  /**
   * Update an existing participant's fields.
   *
   * RULE: an update for an UNKNOWN id is UPSERTed (added), so a roster that
   * missed the original join still converges to the correct state rather than
   * silently dropping presence.
   */
  applyUpdate(participant: Participant): void;
  /**
   * Remove exactly the participant with `id`. Leaving an unknown id is a safe
   * no-op that fires no notification.
   */
  applyLeave(id: string): void;
  /** An immutable snapshot of the current participants. */
  getParticipants(): readonly Participant[];
  /**
   * Register a listener invoked after every mutation that actually changes
   * state (never on a no-op).
   *
   * @returns an unsubscribe closure.
   */
  subscribe(listener: () => void): () => void;
}

/** Structural equality over a participant's fields (including `extra`). */
function sameParticipant(a: Participant, b: Participant): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.color === b.color &&
    JSON.stringify(a.extra ?? null) === JSON.stringify(b.extra ?? null)
  );
}

/**
 * Create a {@link Roster}.
 *
 * Factory closing over a `Map<string, Participant>` and a listener `Set` — no
 * class, no `this`. Each mutator detects whether state actually changed and
 * notifies exactly once per applied change; no-ops stay silent. Removal
 * semantics are deliberately precise (the historically buggy area): leave
 * removes only the target and double/absent leaves are silent no-ops.
 */
export function createRoster(): Roster {
  const participants = new Map<string, Participant>();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function applyJoin(participant: Participant): void {
    const existing = participants.get(participant.id);
    if (existing !== undefined && sameParticipant(existing, participant)) return;
    participants.set(participant.id, participant);
    notify();
  }

  function applyUpdate(participant: Participant): void {
    // Upsert semantics (documented on the interface).
    applyJoin(participant);
  }

  function applyLeave(id: string): void {
    if (!participants.delete(id)) return;
    notify();
  }

  function getParticipants(): readonly Participant[] {
    return [...participants.values()];
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    applyJoin,
    applyUpdate,
    applyLeave,
    getParticipants,
    subscribe,
  };
}
