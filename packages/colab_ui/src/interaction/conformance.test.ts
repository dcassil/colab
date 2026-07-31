/**
 * Conformance tests for the interaction lifecycle contract (see CONTRACT.md).
 *
 * These assert the FOUR responsibilities a correct `useInteraction` must honor,
 * driven against a minimal in-module harness (`createLifecycleHarness`) that
 * models the documented lifecycle — NOT the real I4 hook. Any candidate
 * `useInteraction` implementation that satisfies the contract passes the same
 * assertions.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import type {
  InteractionDescriptor,
  InteractionSelectors,
} from "./descriptor.js";

/**
 * A minimal lifecycle double modelling the documented `useInteraction` contract.
 *
 * (1) seeds fresh state from `initialState`; (2) routes inbound messages whose
 * interaction kind (`payload.name`) matches `descriptor.type` through `reduce`,
 * never throttling inbound; (3) coalesces outbound `toMessage` publishes
 * trailing-edge to ≤1 per `throttle` ms (unthrottled when unset); (4) surfaces
 * `selectors` computed against current state. It publishes via an injected sink
 * so tests observe outbound coalescing.
 */
function createLifecycleHarness<
  State,
  LocalEvent,
  Selectors extends InteractionSelectors<State>,
>(
  descriptor: InteractionDescriptor<State, LocalEvent, Selectors>,
  publish: (message: ColabMessage) => void,
): {
  getState: () => State;
  deliver: (message: ColabMessage) => void;
  send: (event: LocalEvent) => void;
  select: <K extends keyof Selectors>(
    key: K,
  ) => ReturnType<Selectors[K]>;
  dispose: () => void;
} {
  // (1) fresh state per instance.
  let state: State = descriptor.initialState;

  // (2) inbound routing by interaction kind, never throttled.
  function deliver(message: ColabMessage): void {
    const payload = message.payload as { name?: unknown } | undefined;
    if (payload?.name !== descriptor.type) return;
    state = descriptor.reduce(state, message);
  }

  // (3) outbound trailing-edge coalescing.
  const interval = descriptor.throttle;
  let pending: ColabMessage | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): void {
    timer = undefined;
    if (pending === undefined) return;
    const message = pending;
    pending = undefined;
    publish(message);
  }

  function send(event: LocalEvent): void {
    const message = descriptor.toMessage(event);
    if (interval === undefined) {
      publish(message);
      return;
    }
    pending = message; // last-in-window wins
    timer ??= setTimeout(flush, interval);
  }

  function dispose(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  // (4) selector surfacing.
  function select<K extends keyof Selectors>(key: K): ReturnType<Selectors[K]> {
    const selectors = descriptor.selectors;
    if (selectors === undefined) {
      throw new Error(`no selectors declared for "${descriptor.type}"`);
    }
    return selectors[key](state) as ReturnType<Selectors[K]>;
  }

  return { getState: () => state, deliver, send, select, dispose };
}

/** A publish sink that discards — for tests that only assert inbound/state. */
function noop(): void {
  /* intentionally empty */
}

// ── Shared descriptor: per-scope lock state with a parameterized selector ─────

interface LockState {
  locked: Record<string, string | undefined>; // scopeId -> owner id
}

interface LockEvent {
  scopeId: string;
  locked: boolean;
}

function lockDescriptor(throttle?: number): InteractionDescriptor<
  LockState,
  LockEvent,
  {
    isLocked: (state: LockState) => (scopeId: string) => boolean;
    ownerOf: (state: LockState) => (scopeId: string) => string | undefined;
  }
> {
  return {
    type: "editLock",
    initialState: { locked: {} },
    throttle,
    reduce: (state, message): LockState => {
      const payload = message.payload as {
        scopeId?: string;
        data?: { locked?: boolean };
      };
      const scopeId = payload.scopeId ?? "";
      const owner = payload.data?.locked === true ? message.from : undefined;
      return { locked: { ...state.locked, [scopeId]: owner } };
    },
    toMessage: (event): ColabMessage =>
      createMessage(COLAB_EVENTS.INTERACTION, "me", {
        name: "editLock",
        scopeId: asScopeId(event.scopeId),
        data: { locked: event.locked },
      }),
    // Parameterized selectors: return functions of a parameter.
    selectors: {
      isLocked: (state) => (scopeId: string) =>
        state.locked[scopeId] !== undefined,
      ownerOf: (state) => (scopeId: string) => state.locked[scopeId],
    },
  };
}

function inbound(from: string, scopeId: string, locked: boolean): ColabMessage {
  return createMessage(COLAB_EVENTS.INTERACTION, from, {
    name: "editLock",
    scopeId: asScopeId(scopeId),
    data: { locked },
  });
}

describe("conformance — fresh state per instance (contract 1)", () => {
  it("two harnesses over one descriptor keep independent state", () => {
    const descriptor = lockDescriptor();
    const a = createLifecycleHarness(descriptor, noop);
    const b = createLifecycleHarness(descriptor, noop);
    a.deliver(inbound("p1", "s1", true));
    expect(a.getState().locked.s1).toBe("p1");
    expect(b.getState().locked.s1).toBeUndefined();
  });

  it("does not mutate descriptor.initialState", () => {
    const descriptor = lockDescriptor();
    const harness = createLifecycleHarness(descriptor, noop);
    harness.deliver(inbound("p1", "s1", true));
    expect(descriptor.initialState).toEqual({ locked: {} });
  });
});

describe("conformance — inbound routing + immutability (TC-003, contract 2)", () => {
  it("routes matching messages through reduce and keys by from", () => {
    const descriptor = lockDescriptor();
    const harness = createLifecycleHarness(descriptor, noop);
    harness.deliver(inbound("p1", "s1", true));
    expect(harness.getState().locked.s1).toBe("p1");
  });

  it("returns a NEW state object (input not mutated)", () => {
    const descriptor = lockDescriptor();
    const before = descriptor.initialState;
    const harness = createLifecycleHarness(descriptor, noop);
    harness.deliver(inbound("p1", "s1", true));
    const after = harness.getState();
    expect(after).not.toBe(before);
    expect(before.locked).toEqual({});
  });

  it("does not route a non-matching interaction kind to reduce", () => {
    const descriptor = lockDescriptor();
    const harness = createLifecycleHarness(descriptor, noop);
    const foreign = createMessage(COLAB_EVENTS.INTERACTION, "p1", {
      name: "someOtherInteraction",
      scopeId: asScopeId("s1"),
      data: { locked: true },
    });
    harness.deliver(foreign);
    expect(harness.getState()).toBe(descriptor.initialState);
  });
});

describe("conformance — outbound throttle coalescing (TC-004, contract 3)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("coalesces 10 sends in one window to a single trailing publish", () => {
    const descriptor = lockDescriptor(50);
    const published: ColabMessage[] = [];
    const harness = createLifecycleHarness(descriptor, (m) => published.push(m));

    for (let i = 0; i < 10; i += 1) {
      harness.send({ scopeId: `s${String(i)}`, locked: true });
    }
    expect(published).toHaveLength(0); // nothing yet (trailing edge)
    vi.advanceTimersByTime(50);

    expect(published).toHaveLength(1);
    const payload = published[0]?.payload as { scopeId?: string };
    expect(payload.scopeId).toBe("s9"); // last-in-window wins
    harness.dispose();
  });

  it("emits at most one publish per window across multiple windows", () => {
    const descriptor = lockDescriptor(50);
    const published: ColabMessage[] = [];
    const harness = createLifecycleHarness(descriptor, (m) => published.push(m));

    harness.send({ scopeId: "a", locked: true });
    harness.send({ scopeId: "b", locked: true });
    vi.advanceTimersByTime(50);
    harness.send({ scopeId: "c", locked: true });
    vi.advanceTimersByTime(50);

    expect(published).toHaveLength(2);
    harness.dispose();
  });

  it("publishes every send immediately when throttle is unset", () => {
    const descriptor = lockDescriptor(undefined);
    const published: ColabMessage[] = [];
    const harness = createLifecycleHarness(descriptor, (m) => published.push(m));

    harness.send({ scopeId: "a", locked: true });
    harness.send({ scopeId: "b", locked: true });
    expect(published).toHaveLength(2);
    harness.dispose();
  });
});

describe("conformance — selector exposure (contract 4)", () => {
  it("surfaces parameterized selectors as invokable functions", () => {
    const descriptor = lockDescriptor();
    const harness = createLifecycleHarness(descriptor, noop);
    harness.deliver(inbound("p1", "s1", true));

    const isLocked = harness.select("isLocked");
    expect(isLocked("s1")).toBe(true);
    expect(isLocked("s2")).toBe(false);

    const ownerOf = harness.select("ownerOf");
    expect(ownerOf("s1")).toBe("p1");
    expect(ownerOf("s2")).toBeUndefined();
  });
});
