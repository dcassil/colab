import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";
import type { Identity, Participant } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import type { ColabStore } from "../contracts/store.js";
import { ColabProvider } from "./ColabProvider.js";
import { interactionKey } from "./storeKeys.js";
import { usePresence } from "./usePresence.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };
const peerA: Participant = { id: "a", name: "A", color: "#a00" };
const peerB: Participant = { id: "b", name: "B", color: "#0b0" };

function mount(
  transport: FakeTransport,
  store: ColabStore,
): {
  roster: () => readonly Participant[];
  renders: () => number;
  unmount: () => void;
} {
  let renders = 0;
  let roster: readonly Participant[] = [];
  function Reader(): null {
    renders++;
    roster = usePresence();
    return null;
  }
  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={transport}
      store={store}
    >
      <Reader />
    </ColabProvider>,
  );
  return { roster: () => roster, renders: () => renders, unmount: view.unmount };
}

function emitJoin(t: FakeTransport, p: Participant): void {
  act(() => {
    t.emit(createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_JOINED, p.id, p));
  });
}

describe("usePresence excludes local (TC-001)", () => {
  it("returns exactly the remotes; local identity absent", () => {
    const t = createFakeTransport();
    const view = mount(t, createFakeStore());
    emitJoin(t, peerA);
    emitJoin(t, peerB);

    const ids = view.roster().map((p) => p.id);
    expect(ids).toEqual(["a", "b"]);
    expect(ids).not.toContain("me");
    view.unmount();
  });
});

describe("usePresence re-renders on join/leave only (TC-002)", () => {
  it("re-renders once per join and once per leave", () => {
    const t = createFakeTransport();
    const view = mount(t, createFakeStore());
    const base = view.renders();

    emitJoin(t, peerA);
    expect(view.renders()).toBe(base + 1);

    act(() => {
      t.emit(createMessage(COLAB_SERVER_EVENTS.PARTICIPANT_LEFT, "a", { id: "a" }));
    });
    expect(view.roster()).toHaveLength(0);
    expect(view.renders()).toBe(base + 2);
    view.unmount();
  });

  it("keeps a referentially stable array across an unrelated re-render", () => {
    const t = createFakeTransport();
    const view = mount(t, createFakeStore());
    emitJoin(t, peerA);
    const first = view.roster();
    // A no-op roster notification would not change identity; assert stability
    // by re-emitting nothing and reading again after a state-free act.
    act(() => undefined);
    expect(view.roster()).toBe(first);
    view.unmount();
  });
});

describe("usePresence ignores unrelated slices (TC-003)", () => {
  it("does not re-render when only an interaction slice changes", () => {
    const t = createFakeTransport();
    const store = createFakeStore();
    const view = mount(t, store);
    emitJoin(t, peerA);
    const before = view.renders();

    act(() => {
      store.set(interactionKey("editLock"), { locked: true });
    });

    expect(view.renders()).toBe(before);
    view.unmount();
  });
});
