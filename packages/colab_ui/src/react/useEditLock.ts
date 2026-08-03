/**
 * `useEditLock` — cooperative, first-holder-wins advisory edit-lock over the
 * generic {@link EditLock} interaction, with built-in stuck-lock prevention.
 *
 * PRESENCE / EDIT-LOCKS ONLY — no CRDT/OT, no document merge. Drives the `colab`
 * `EditLock` interaction's `send({ scopeId, action })` as the caller's selected
 * scope changes, and resolves the current holder from the reconciled lock state
 * and the `usePresence()` roster. The scope-id SHAPE is a CONSUMER concern: this
 * hook takes an OPAQUE {@link ScopeId} (compose it with `composeScopeId(...)`),
 * so two callers editing DIFFERENT scopes never block each other.
 *
 * Must be called from inside a `<ColabProvider>` whose `interactions` include
 * {@link EditLock}. The session lifecycle (connect/join/roster/transport) is
 * owned by the provider; this hook is a thin scope → `send` binding plus the
 * safety-clears below. Not throttled — edit-lock changes must be prompt.
 *
 * COOPERATIVE MUTUAL EXCLUSION — the `EditLock` reduce is last-write-wins (a
 * second `action:"lock"` STEALS the scope). To make locks behave as
 * first-holder-wins on the client, this hook does NOT send a lock for a scope
 * already held by a DIFFERENT participant: it reads the current holder via the
 * `lockedBy` selector before acquiring. It also only sends `clear` for a lock it
 * actually took, so a blocked scope never emits a stray `clear` that would drop
 * the remote holder's lock. `selfId` identifies this client's own locks.
 *
 * NOTE: this is cooperative, client-side policy — a malicious/older client could
 * still steal. Server-enforced first-holder-wins is a `colab-server` concern.
 *
 * LIFECYCLE SAFETY-CLEARS — beyond the scope→lock binding, two belt-and-
 * suspenders releases ensure an unattended lock never blocks others:
 *
 *  1. RELOAD / LEAVE / CLOSE (`pagehide` + `beforeunload`): synchronously emit a
 *     `clear` for the scope currently held, so the lock releases INSTANTLY
 *     rather than waiting for the server's socket-close reconcile. bfcache-safe
 *     (`pagehide` fires on bfcache navigations) and correct — only a scope this
 *     hook actually acquired is cleared.
 *  2. IDLE RELEASE (`idleMs`, default {@link DEFAULT_IDLE_RELEASE_MS}): a timer,
 *     reset on real user interaction (`pointermove` / `pointerdown` / `keydown`,
 *     `isTrusted`-filtered so synthetic events never keep a lock alive),
 *     releases the held lock after the idle window so an AFK holder stops
 *     blocking others. The next interaction + scope re-acquires via the normal
 *     path.
 *
 * Both are cleaned up (listeners + timer) on unmount, and both no-op when
 * nothing is held. They never emit a `clear` for a scope held by another
 * participant.
 */
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import type { ScopeId } from "colab-protocol";

import {
  EditLock,
  type EditLockEvent,
  type EditLockSelectors,
  type EditLockState,
  type ParticipantId,
} from "../interactions/edit-lock/index.js";
import { useInteraction } from "./useInteraction.js";
import { usePresence } from "./usePresence.js";

/** Default idle threshold after which the local user's held lock is released. */
export const DEFAULT_IDLE_RELEASE_MS = 5 * 60 * 1000;

/**
 * Install the reload/leave/close safety-clear: on `pagehide`/`beforeunload`,
 * synchronously release whatever lock `release` currently holds. `pagehide`
 * covers reload/navigation/close (and bfcache) reliably; `beforeunload` is the
 * belt to its suspenders. `release` is a ref so the once-installed listeners
 * always call the live binding.
 */
function useLifecycleSafetyClear(release: RefObject<() => void>): void {
  useEffect(() => {
    const onLifecycle = (): void => {
      release.current();
    };
    window.addEventListener("pagehide", onLifecycle);
    window.addEventListener("beforeunload", onLifecycle);
    return () => {
      window.removeEventListener("pagehide", onLifecycle);
      window.removeEventListener("beforeunload", onLifecycle);
    };
  }, [release]);
}

/**
 * Install the idle safety-clear: after `idleMs` of no GENUINE user interaction
 * (`isTrusted`-filtered `pointermove`/`pointerdown`/`keydown`), release the held
 * lock via `release`. The next interaction + scope re-acquires normally.
 */
function useIdleSafetyClear(
  idleMs: number,
  release: RefObject<() => void>,
): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        release.current();
      }, idleMs);
    };
    // `isTrusted` filters out programmatic/synthetic events so scripted
    // dispatches never keep a lock alive.
    const onActivity = (event: Event): void => {
      if (!event.isTrusted) return;
      arm();
    };
    const events: readonly (keyof WindowEventMap)[] = [
      "pointermove",
      "pointerdown",
      "keydown",
    ];
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    arm(); // start the idle countdown immediately
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      for (const name of events) {
        window.removeEventListener(name, onActivity);
      }
    };
  }, [idleMs, release]);
}

/** Optional tuning for {@link useEditLock}. */
export interface UseEditLockOptions {
  /** Idle window in ms before the held lock auto-releases (default 5 min). */
  idleMs?: number;
}

/** The reconciled remote-lock view {@link useEditLock} resolves for the scope. */
export interface EditLockStatus {
  /** True when a DIFFERENT participant currently holds this scope. */
  lockedByRemote: boolean;
  /** The remote holder's display name (from the roster), or `null`. */
  holder: string | null;
}

/**
 * Cooperatively acquire the advisory edit-lock for `scopeId` (when non-null and
 * free), release-what-was-taken on scope change / unmount, safety-clear on
 * reload/leave and after idle, and resolve the current remote holder.
 *
 * @param scopeId opaque lock scope; `null` takes no lock (e.g. nothing selected)
 * @param selfId  this client's participant id — its own locks never read as remote
 * @param options optional `{ idleMs }` idle-release tuning
 * @throws when `EditLock` is not registered, or when used outside a provider.
 */
export function useEditLock(
  scopeId: ScopeId | null,
  selfId: string,
  options?: UseEditLockOptions,
): EditLockStatus {
  const idleMs = options?.idleMs ?? DEFAULT_IDLE_RELEASE_MS;

  const { send, selectors } = useInteraction<EditLockState, EditLockSelectors>(
    EditLock,
  );
  const roster = usePresence();

  // `lockedBy` is bound to the current state by `useInteraction`, so
  // `lockedBy(scope)` yields the holder directly. Held in a ref so the acquire
  // effect samples the CURRENT holder without depending on `selectors` (a fresh
  // object each render). We sample once, at acquire time, on a scope/self change;
  // a holder change mid-hold is surfaced to the caller via the returned status,
  // not by re-running acquisition.
  const lockedByRef = useRef(selectors.lockedBy);
  lockedByRef.current = selectors.lockedBy;

  // `send` in a ref so the once-installed lifecycle/idle handlers always call the
  // latest transport binding without re-subscribing their listeners.
  const sendRef = useRef(send);
  sendRef.current = send;

  // The exact scope this hook currently holds a lock on, or `null`. The safety-
  // clears read this so they only ever release a lock this hook owns.
  const heldScopeRef = useRef<ScopeId | null>(null);

  // Idempotent release of the currently-held lock, shared by all safety-clears.
  // Emits one `clear` for the held scope (if any) and forgets it, so a
  // subsequent release is a no-op. Stable identity across renders.
  const releaseHeldRef = useRef((): void => {
    const held = heldScopeRef.current;
    if (held === null) return;
    heldScopeRef.current = null;
    const clear: EditLockEvent = { scopeId: held, action: "clear" };
    sendRef.current(clear);
  });

  // ---- scope → acquire / release binding ----
  useEffect(() => {
    if (scopeId !== null) {
      // Don't steal a lock a different participant already holds.
      const holder = lockedByRef.current(scopeId);
      if (holder !== null && holder !== selfId) {
        return undefined;
      }
      const lock: EditLockEvent = { scopeId, action: "lock" };
      send(lock);
      heldScopeRef.current = scopeId;
      return () => {
        // Only clear the lock actually acquired above.
        const clear: EditLockEvent = { scopeId, action: "clear" };
        send(clear);
        if (heldScopeRef.current === scopeId) heldScopeRef.current = null;
      };
    }
    return undefined;
  }, [send, scopeId, selfId]);

  // ---- reload/leave/close + idle safety-clears (extracted; see helpers) ----
  useLifecycleSafetyClear(releaseHeldRef);
  useIdleSafetyClear(idleMs, releaseHeldRef);

  // ---- resolve the remote holder for the current scope ----
  return useMemo<EditLockStatus>(() => {
    if (scopeId === null) return { lockedByRemote: false, holder: null };
    const holderId: ParticipantId | null = selectors.lockedBy(scopeId);
    if (holderId === null || holderId === selfId) {
      return { lockedByRemote: false, holder: null };
    }
    const participant = roster.find((p) => p.id === holderId);
    return { lockedByRemote: true, holder: participant?.name ?? null };
  }, [scopeId, selfId, selectors, roster]);
}
