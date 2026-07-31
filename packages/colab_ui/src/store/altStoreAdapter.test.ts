import { describe, expect, it, vi } from "vitest";

import type { ColabStore } from "../contracts/store.js";

import { runStoreContract } from "./storeContract.js";

/**
 * TC-001 — STORE SWAPPABILITY EVIDENCE.
 *
 * An ALTERNATE `ColabStore` adapter that lives entirely in test/fixture space
 * (NO core file is touched) and is backed by a deliberately different substrate
 * than the default `createInMemoryStore`: a mock "external" manager exposing a
 * single flat record + a global revision counter, mimicking how a real Zustand/
 * Redux/valtio store would be wrapped behind the `ColabStore` façade.
 *
 * It implements the I2 `ColabStore` interface VERBATIM and passes the SAME
 * shared `runStoreContract` suite the default store passes — proving the store
 * seam is swappable without forking core. Reference stability is preserved
 * (values are held by reference), so it runs the full contract.
 */
interface ExternalManager {
  state: Record<string, unknown>;
  version: number;
}

function createAltStore(): ColabStore {
  // A single external manager object standing in for a third-party store.
  const external: ExternalManager = { state: {}, version: 0 };
  const watchers = new Map<string, Set<() => void>>();
  const has = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(external.state, key);

  return {
    get: (key) => (has(key) ? external.state[key] : undefined),
    set: (key, value) => {
      if (has(key) && Object.is(external.state[key], value)) return;
      // Replace the record immutably (external-manager style) and bump version.
      external.state = { ...external.state, [key]: value };
      external.version += 1;
      for (const w of Array.from(watchers.get(key) ?? [])) w();
    },
    subscribe: (key, listener) => {
      let set = watchers.get(key);
      if (set === undefined) {
        set = new Set<() => void>();
        watchers.set(key, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}

// The alternate adapter passes the identical shared store contract.
runStoreContract(createAltStore, "alternate external-backed adapter");

describe("store swappability (alternate adapter drives colab state)", () => {
  it("drives a keyed state update through the alternate adapter", () => {
    // Use the alternate adapter exactly where the default in-memory store would
    // sit — the seam consumer sees only the ColabStore interface.
    const store: ColabStore = createAltStore();
    const roster = [{ id: "a" }];
    const observed: unknown[] = [];
    store.subscribe("roster", () => {
      observed.push(store.get("roster"));
    });

    store.set("roster", roster);
    store.set("roster", roster); // no-op: unchanged reference, no extra notify

    expect(observed).toEqual([roster]);
    expect(store.get("roster")).toBe(roster);
  });

  it("keeps the swap fully within test space (interface-only consumer)", () => {
    const store = createAltStore();
    // A consumer written against ColabStore needs no knowledge of the backing.
    const spy = vi.fn();
    const unsub = store.subscribe("presence", spy);
    store.set("presence", { online: 2 });
    unsub();
    store.set("presence", { online: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
