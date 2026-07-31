import { describe, expect, it, vi } from "vitest";

import type { ColabStore } from "../contracts/store.js";

import { createInMemoryStore } from "./inMemoryStore.js";

describe("createInMemoryStore", () => {
  it("satisfies the keyed ColabStore contract shape", () => {
    const store: ColabStore = createInMemoryStore();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.subscribe).toBe("function");
  });

  it("returns undefined for an unset key", () => {
    const store = createInMemoryStore();
    expect(store.get("missing")).toBeUndefined();
  });

  // TC-001: reference stability on unchanged state.
  it("keeps the same reference and does not notify on unchanged state", () => {
    const store = createInMemoryStore();
    const initial = { a: 1 };
    store.set("k", initial);
    const spy = vi.fn();
    store.subscribe("k", spy);

    const s1 = store.get("k");
    store.set("k", s1); // same reference
    const s2 = store.get("k");

    expect(Object.is(s1, s2)).toBe(true);
    expect(Object.is(s1, initial)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  // TC-002: new reference + synchronous single notification on change.
  it("stores the new reference and notifies synchronously exactly once", () => {
    const store = createInMemoryStore();
    store.set("k", { a: 1 });
    const spy = vi.fn();
    store.subscribe("k", spy);

    const next = { a: 2 };
    let getInsideSet: unknown;
    spy.mockImplementation(() => {
      // Prove notification is synchronous: state is already updated when the
      // listener runs, before `set` returns.
      getInsideSet = store.get("k");
    });
    store.set("k", next);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(Object.is(getInsideSet, next)).toBe(true);
    expect(Object.is(store.get("k"), next)).toBe(true);
  });

  // TC-003: idempotent, leak-free unsubscribe.
  it("has an idempotent unsubscribe that stops notifications", () => {
    const store = createInMemoryStore();
    const spy = vi.fn();
    const unsubscribe = store.subscribe("k", spy);

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();

    store.set("k", { a: 99 });
    expect(spy).not.toHaveBeenCalled();
  });

  // TC-004: unsubscribe during notification is safe.
  it("does not corrupt iteration when a listener unsubscribes another", () => {
    const store = createInMemoryStore();
    const bSpy = vi.fn();
    const aSpy = vi.fn();
    let unsubscribeB = (): void => {
      /* replaced after subscribe */
    };
    aSpy.mockImplementation(() => {
      unsubscribeB();
    });
    store.subscribe("k", aSpy);
    unsubscribeB = store.subscribe("k", bSpy);

    expect(() => {
      store.set("k", { a: 2 });
    }).not.toThrow();
    expect(aSpy).toHaveBeenCalledTimes(1);

    // B is absent on the next change regardless of this-pass behavior.
    aSpy.mockImplementation(() => {
      /* no-op on subsequent passes */
    });
    const bCallsAfterFirst = bSpy.mock.calls.length;
    store.set("k", { a: 3 });
    expect(bSpy).toHaveBeenCalledTimes(bCallsAfterFirst);
  });

  it("notifies all registered listeners for a key on change", () => {
    const store = createInMemoryStore();
    const s1 = vi.fn();
    const s2 = vi.fn();
    store.subscribe("k", s1);
    store.subscribe("k", s2);
    store.set("k", { a: 1 });
    expect(s1).toHaveBeenCalledTimes(1);
    expect(s2).toHaveBeenCalledTimes(1);
  });

  it("isolates keys: a change to one key does not notify another", () => {
    const store = createInMemoryStore();
    const kSpy = vi.fn();
    const jSpy = vi.fn();
    store.subscribe("k", kSpy);
    store.subscribe("j", jSpy);
    store.set("k", { a: 1 });
    expect(kSpy).toHaveBeenCalledTimes(1);
    expect(jSpy).not.toHaveBeenCalled();
  });
});
