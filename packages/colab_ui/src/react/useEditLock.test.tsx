/**
 * Unit/integration tests for `useEditLock` — the cooperative, stuck-lock-safe
 * edit-lock hook. Ported from the stardust demo's `usePublishEditLock` tests and
 * adapted to colab-ui's own harness: instead of mocking `colab-ui`, these mount
 * the REAL {@link EditLock} interaction under a real `<ColabProvider>` with the
 * fake transport/store, so the actual reduce/selector/roster machinery runs.
 *
 * Coverage:
 *  - COOPERATIVE ACQUIRE: a `lock` is sent for a free scope; NO `lock` is sent
 *    (and nothing is held) when a different participant already holds the scope.
 *  - RELEASE-ONLY-OWN: a held lock clears on scope change / unmount; a blocked
 *    scope never emits a stray `clear`.
 *  - RELOAD / LEAVE / CLOSE: `pagehide` / `beforeunload` clear the held lock; no
 *    clear when nothing is held.
 *  - IDLE RELEASE: fires after `idleMs`; a programmatic (untrusted) event does
 *    NOT re-arm the countdown (see the jsdom `isTrusted` note below).
 *  - HOLDER RESOLUTION: `{ lockedByRemote, holder }` resolves the remote holder's
 *    name from the roster.
 *
 * jsdom hard-codes `Event.isTrusted` to `false` on every synthesized Event, so a
 * genuinely trusted event cannot be built here. The `isTrusted` gate is proven by
 * its contrapositive — an untrusted event does NOT re-arm — with the positive
 * re-arm exercised by the live-app Playwright run.
 */
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COLAB_EVENTS,
  COLAB_SERVER_EVENTS,
  asScopeId,
  createMessage,
} from "colab-protocol";
import type { Identity, Participant, ScopeId } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import { EditLock } from "../interactions/edit-lock/index.js";
import { ColabProvider } from "./ColabProvider.js";
import { useEditLock, DEFAULT_IDLE_RELEASE_MS } from "./useEditLock.js";
import type { EditLockStatus } from "./useEditLock.js";

const identity: Identity = { id: "self-1", name: "Me", color: "#fff" };
const SELF = identity.id;
const SCOPE: ScopeId = asScopeId("t1::c1");

// Stable so the provider's session (memoized on these props) is NOT recreated
// across scope changes — a fresh interactions array would rebuild the session
// (dropping the outbound relay's `localId`) exactly like a real app avoids.
const INTERACTIONS = [EditLock] as const;

/** `act` wrappers with block bodies (a shorthand `act(() => expr)` trips lint). */
function actFire(event: Event): void {
  act(() => {
    window.dispatchEvent(event);
  });
}
function actAdvance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function mount(
  scopeId: ScopeId | null,
  transport: FakeTransport,
  store: ColabStore,
  idleMs?: number,
): {
  status: () => EditLockStatus;
  rerender: (scopeId: ScopeId | null) => void;
  unmount: () => void;
} {
  let status: EditLockStatus = { lockedByRemote: false, holder: null };
  let setScope: (scope: ScopeId | null) => void = () => undefined;
  let setMounted: (mounted: boolean) => void = () => undefined;

  function Reader(): null {
    // Scope lives in the child's OWN state so changing it re-renders ONLY the
    // child (the provider element is stable), just like a real selection change.
    const [scope, set] = useState<ScopeId | null>(null);
    setScope = set;
    status = useEditLock(scope, SELF, idleMs === undefined ? undefined : { idleMs });
    return null;
  }

  // The Reader is mounted/unmounted UNDER a stable, still-connected provider, so
  // unmounting the lock holder runs its release while the session is alive — the
  // real case (a field component unmounts; the ColabProvider stays mounted).
  function Host(): React.ReactNode {
    const [mounted, set] = useState(true);
    setMounted = set;
    return mounted ? <Reader /> : null;
  }

  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={transport}
      store={store}
      interactions={INTERACTIONS}
    >
      <Host />
    </ColabProvider>,
  );

  // The provider connects + joins with NO scope first (child effects run before
  // the provider's join effect), so the outbound relay is wired before any
  // acquire; then apply the requested scope so the lock actually relays.
  const rerender = (scope: ScopeId | null): void => {
    act(() => {
      setScope(scope);
    });
  };
  if (scopeId !== null) rerender(scopeId);
  // Unmount ONLY the lock-holding child (provider/session stay alive), then tear
  // down the whole tree.
  const unmount = (): void => {
    act(() => {
      setMounted(false);
    });
    act(() => {
      view.unmount();
    });
  };
  return { status: () => status, rerender, unmount };
}

/** The `{ scopeId, action }` of an outbound EditLock message, or null. */
function editLockEvents(
  transport: FakeTransport,
): { scopeId: string; action: string }[] {
  return transport.sent
    .filter((m) => m.type === COLAB_EVENTS.INTERACTION)
    .map((m) => m.payload as { name?: string; scopeId?: string; data?: { action?: string } })
    .filter((p) => p.name === "edit-lock")
    .map((p) => ({ scopeId: String(p.scopeId), action: String(p.data?.action) }));
}
function lockCalls(t: FakeTransport): { scopeId: string }[] {
  return editLockEvents(t).filter((e) => e.action === "lock");
}
function clearCalls(t: FakeTransport): { scopeId: string }[] {
  return editLockEvents(t).filter((e) => e.action === "clear");
}

/** Simulate a remote participant taking `scope` (roster join + inbound lock). */
function remoteLocks(
  t: FakeTransport,
  peer: Participant,
  scope: ScopeId,
): void {
  act(() => {
    t.emit(createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, peer.id, peer));
    t.emit(
      createMessage(COLAB_EVENTS.INTERACTION, peer.id, {
        name: "edit-lock",
        scopeId: scope,
        data: { action: "lock" },
      }),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("useEditLock cooperative acquire", () => {
  it("acquires a lock for the selected free scope", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    expect(lockCalls(t)).toHaveLength(1);
    expect(lockCalls(t).map((e) => e.scopeId)).toEqual([SCOPE]);
    view.unmount();
  });

  it("takes no lock and holds nothing when a different participant owns the scope", () => {
    const t = createFakeTransport();
    const store = createFakeStore();
    const peer: Participant = { id: "other-user", name: "Other", color: "#0b0" };
    // Provider must exist before inbound folds; mount with no scope, then lock, then select.
    const view = mount(null, t, store);
    remoteLocks(t, peer, SCOPE);
    view.rerender(SCOPE);

    expect(lockCalls(t)).toHaveLength(0);
    // Nothing held → idle + pagehide are no-ops.
    actFire(new Event("pagehide"));
    actAdvance(DEFAULT_IDLE_RELEASE_MS);
    expect(clearCalls(t)).toHaveLength(0);
    view.unmount();
  });
});

describe("useEditLock release-only-own", () => {
  it("clears the held lock on unmount", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    view.unmount();
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
  });

  it("clears the prior scope when the selection moves to another scope", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    const next = asScopeId("t1::c2");
    view.rerender(next);
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
    expect(lockCalls(t).some((e) => e.scopeId === next)).toBe(true);
    view.unmount();
  });
});

describe("useEditLock idle release", () => {
  it("releases the held lock after idleMs of no interaction", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    expect(clearCalls(t)).toHaveLength(0);

    actAdvance(DEFAULT_IDLE_RELEASE_MS - 1);
    expect(clearCalls(t)).toHaveLength(0); // not yet

    actAdvance(1);
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
    view.unmount();
  });

  it("honors a custom idleMs", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore(), 1000);
    actAdvance(999);
    expect(clearCalls(t)).toHaveLength(0);
    actAdvance(1);
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
    view.unmount();
  });

  it("a programmatic (untrusted) event does NOT re-arm the idle countdown", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());

    actAdvance(DEFAULT_IDLE_RELEASE_MS - 1000);
    actFire(new Event("keydown")); // jsdom isTrusted:false
    actAdvance(1000);
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true); // fired; NOT re-armed
    view.unmount();
  });
});

describe("useEditLock reload/leave/close safety-clear", () => {
  it("clears the held lock on pagehide", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    actFire(new Event("pagehide"));
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
    view.unmount();
  });

  it("clears the held lock on beforeunload", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    actFire(new Event("beforeunload"));
    expect(clearCalls(t).some((e) => e.scopeId === SCOPE)).toBe(true);
    view.unmount();
  });

  it("does NOT clear on pagehide when no scope is held (nothing selected)", () => {
    const t = createFakeTransport();
    const view = mount(null, t, createFakeStore());
    actFire(new Event("pagehide"));
    expect(clearCalls(t)).toHaveLength(0);
    view.unmount();
  });
});

describe("useEditLock holder resolution", () => {
  it("resolves lockedByRemote + holder name from the roster", () => {
    const t = createFakeTransport();
    const store = createFakeStore();
    const peer: Participant = { id: "other-user", name: "Alice", color: "#0b0" };
    const view = mount(null, t, store);
    remoteLocks(t, peer, SCOPE);
    view.rerender(SCOPE);

    expect(view.status()).toEqual({ lockedByRemote: true, holder: "Alice" });
    view.unmount();
  });

  it("reports no remote holder for a free scope or one this client holds", () => {
    const t = createFakeTransport();
    const view = mount(SCOPE, t, createFakeStore());
    // This client took the lock; it is not a remote holder.
    expect(view.status()).toEqual({ lockedByRemote: false, holder: null });
    view.unmount();
  });
});
