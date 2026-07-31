import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import { ColabProvider } from "./ColabProvider.js";
import { useColabStore } from "./useColabStore.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

const selectA = (raw: unknown): number => (raw as { n: number } | undefined)?.n ?? 0;
const selectB = (raw: unknown): number => (raw as { n: number } | undefined)?.n ?? 0;

function mountReader(
  store: ColabStore,
  key: string,
  selector: (raw: unknown) => number,
): { renders: () => number; value: () => number; unmount: () => void } {
  let renders = 0;
  let value = -1;
  function Reader(): null {
    renders++;
    value = useColabStore(key, selector);
    return null;
  }
  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={createFakeTransport()}
      store={store}
    >
      <Reader />
    </ColabProvider>,
  );
  return {
    renders: () => renders,
    value: () => value,
    unmount: view.unmount,
  };
}

describe("useColabStore no-op stability (TC-001)", () => {
  it("does not re-render when a notification leaves the slice unchanged", () => {
    const store = createFakeStore();
    store.set("a", { n: 1 });
    const reader = mountReader(store, "a", selectA);
    const before = reader.renders();

    // Re-set the SAME reference: fake store notifies, but the selected slice
    // (n) is unchanged, so the cached snapshot stays identical → no re-render.
    act(() => {
      store.set("a", store.get("a"));
    });

    expect(reader.renders()).toBe(before);
    reader.unmount();
  });
});

describe("useColabStore relevant change (TC-002)", () => {
  it("re-renders once with the new value when the slice changes", () => {
    const store = createFakeStore();
    store.set("a", { n: 1 });
    const reader = mountReader(store, "a", selectA);
    const before = reader.renders();

    act(() => {
      store.set("a", { n: 2 });
    });

    expect(reader.value()).toBe(2);
    expect(reader.renders()).toBe(before + 1);
    reader.unmount();
  });
});

describe("useColabStore selective re-render across slices (TC-003)", () => {
  it("re-renders only the consumer whose slice changed", () => {
    const store = createFakeStore();
    store.set("a", { n: 1 });
    store.set("b", { n: 1 });

    let aRenders = 0;
    let bRenders = 0;
    function A(): null {
      aRenders++;
      useColabStore("a", selectA);
      return null;
    }
    function B(): null {
      bRenders++;
      useColabStore("b", selectB);
      return null;
    }
    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={createFakeTransport()}
        store={store}
      >
        <A />
        <B />
      </ColabProvider>,
    );
    const aBefore = aRenders;
    const bBefore = bRenders;

    act(() => {
      store.set("b", { n: 2 });
    });

    expect(aRenders).toBe(aBefore);
    expect(bRenders).toBe(bBefore + 1);
    view.unmount();
  });
});

describe("useColabStore snapshot caching for derived slices", () => {
  it("keeps a derived-object snapshot stable across no-op notifications", () => {
    const store = createFakeStore();
    store.set("a", { n: 5 });
    // A selector that derives a NEW object each call would loop without the
    // hook's cache; assert the consumer stays stable and does not thrash.
    const derive = (raw: unknown): { doubled: number } => ({
      doubled: ((raw as { n: number } | undefined)?.n ?? 0) * 2,
    });
    let renders = 0;
    let last: { doubled: number } | undefined;
    function Reader(): null {
      renders++;
      const ref = useRef<{ doubled: number } | undefined>(undefined);
      const v = useColabStore("a", derive);
      last = v;
      ref.current = v;
      return null;
    }
    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={createFakeTransport()}
        store={store}
      >
        <Reader />
      </ColabProvider>,
    );
    const before = renders;
    act(() => {
      store.set("a", store.get("a")); // no-op notify
    });
    expect(renders).toBe(before);
    expect(last?.doubled).toBe(10);
    view.unmount();
  });
});
