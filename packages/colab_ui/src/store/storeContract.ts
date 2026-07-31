/**
 * Shared, parameterized {@link ColabStore} contract suite.
 *
 * `runStoreContract` registers the behavioral expectations EVERY `ColabStore`
 * must uphold — keyed get/set/subscribe, reference stability, synchronous
 * single notification on real change, key isolation, and idempotent unsubscribe
 * — parameterized purely over a `makeStore` factory. The default
 * `createInMemoryStore` runs it; the swappability task (T5) runs the SAME suite
 * against an alternate (Map/external-backed) adapter to prove the store seam is
 * swappable with no changes to core.
 *
 * NOTE ON REFERENCE STABILITY: adapters MAY store values by reference (the
 * in-memory default does). Cases that assert `Object.is` identity of a stored
 * OBJECT value therefore apply to reference-preserving adapters; an adapter that
 * serializes values would opt out of those. The alternate adapter here is
 * reference-preserving, so it runs the full suite.
 *
 * This module is NOT a test file: it exports a function a `.test.ts` invokes.
 */
import { describe, expect, it, vi } from "vitest";

import type { ColabStore } from "../contracts/store.js";

/** A factory producing a fresh {@link ColabStore}. */
export type MakeStore = () => ColabStore;

/** Register the shared store contract for a `ColabStore` implementation. */
export function runStoreContract(makeStore: MakeStore, label: string): void {
  describe(`ColabStore contract: ${label}`, () => {
    it("returns undefined for an unset key", () => {
      expect(makeStore().get("missing")).toBeUndefined();
    });

    it("reads back the value written at a key", () => {
      const store = makeStore();
      store.set("k", { a: 1 });
      expect(store.get("k")).toEqual({ a: 1 });
    });

    it("keeps a stable reference and does not notify on unchanged state", () => {
      const store = makeStore();
      const initial = { a: 1 };
      store.set("k", initial);
      const spy = vi.fn();
      store.subscribe("k", spy);

      const s1 = store.get("k");
      store.set("k", s1);
      const s2 = store.get("k");

      expect(Object.is(s1, s2)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("stores a new reference and notifies synchronously exactly once", () => {
      const store = makeStore();
      store.set("k", { a: 1 });
      const spy = vi.fn();
      store.subscribe("k", spy);

      const next = { a: 2 };
      store.set("k", next);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(Object.is(store.get("k"), next)).toBe(true);
    });

    it("notifies all listeners for a key and isolates other keys", () => {
      const store = makeStore();
      const kSpy = vi.fn();
      const kSpy2 = vi.fn();
      const jSpy = vi.fn();
      store.subscribe("k", kSpy);
      store.subscribe("k", kSpy2);
      store.subscribe("j", jSpy);

      store.set("k", { a: 1 });

      expect(kSpy).toHaveBeenCalledTimes(1);
      expect(kSpy2).toHaveBeenCalledTimes(1);
      expect(jSpy).not.toHaveBeenCalled();
    });

    it("has an idempotent unsubscribe that stops notifications", () => {
      const store = makeStore();
      const spy = vi.fn();
      const unsubscribe = store.subscribe("k", spy);

      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();

      store.set("k", { a: 99 });
      expect(spy).not.toHaveBeenCalled();
    });
  });
}
