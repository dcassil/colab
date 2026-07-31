/**
 * Lifecycle wiring tests for `useInteraction` (interaction/CONTRACT.md).
 *
 * Asserts the four responsibilities the hook must honor against the REAL hook +
 * provider + Cursor descriptor: (1) `initialState` seeding, (3) trailing-edge
 * outbound throttle coalescing (TC-004), and (4) selector surfacing. Inbound
 * routing (2) is covered by the existing mirror tests.
 */
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "colab-protocol";
import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../__tests__/fakes.js";
import type { FakeTransport } from "../__tests__/fakes.js";
import { createCursorInteraction } from "../interactions/cursor/cursor.js";
import type { CursorState, RemoteCursorEntry } from "../interactions/cursor/cursor.js";
import { createInteractionRegistry } from "../core/registry.js";
import { ColabProvider } from "./ColabProvider.js";
import { useInteraction } from "./useInteraction.js";
import type { UseInteractionResult } from "./useInteraction.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

interface CursorSelectors {
  remoteCursors: (state: CursorState) => RemoteCursorEntry[];
  presentCursors: (
    state: CursorState,
  ) => (presentIds: readonly string[]) => RemoteCursorEntry[];
}

function mountCursor(transport: FakeTransport): {
  result: () => UseInteractionResult<CursorState, CursorSelectors>;
  unmount: () => void;
} {
  // Fresh registry so the module-level default `Cursor` duplicate guard is idle.
  const cursor = createCursorInteraction(createInteractionRegistry());
  let result: UseInteractionResult<CursorState, CursorSelectors> | undefined;
  function Reader(): null {
    result = useInteraction(cursor);
    return null;
  }
  const view = render(
    <ColabProvider
      serverUrl="https://relay.example"
      room="r"
      identity={identity}
      transport={transport}
      store={createFakeStore()}
      interactions={[cursor]}
    >
      <Reader />
    </ColabProvider>,
  );
  return {
    result: () => {
      if (result === undefined) throw new Error("no result");
      return result;
    },
    unmount: view.unmount,
  };
}

describe("useInteraction lifecycle — initialState seeding (contract 1)", () => {
  it("seeds state + selectors from the descriptor initialState pre-fold", () => {
    const view = mountCursor(createFakeTransport());
    // Before any fold, state is the seeded {} (not undefined), and the
    // selectors compute against it.
    expect(view.result().state).toEqual({});
    expect(view.result().selectors.remoteCursors).toEqual([]);
    view.unmount();
  });
});

describe("useInteraction lifecycle — outbound throttle (contract 3, TC-004)", () => {
  it("coalesces 10 rapid sends within one window to a single publish", () => {
    vi.useFakeTimers();
    const transport = createFakeTransport();
    const view = mountCursor(transport);

    act(() => {
      for (let i = 0; i < 10; i += 1) {
        view.result().send({ x: i / 10, y: i / 10 });
      }
    });
    // Trailing edge: nothing relayed to the transport yet.
    const before = transport.sent.filter(
      (m) => m.type === COLAB_EVENTS.INTERACTION,
    ).length;
    expect(before).toBe(0);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    const after = transport.sent.filter(
      (m) => m.type === COLAB_EVENTS.INTERACTION,
    );
    expect(after).toHaveLength(1);
    // Last-in-window wins, stamped with the local id.
    expect(after[0]?.from).toBe("me");
    view.unmount();
    vi.useRealTimers();
  });
});

describe("useInteraction lifecycle — selectors surface state (contract 4)", () => {
  it("recomputes selectors after an inbound fold updates state", () => {
    const transport = createFakeTransport();
    const view = mountCursor(transport);

    act(() => {
      transport.emit({
        type: COLAB_SERVER_EVENTS.INTERACTION,
        from: "p1",
        payload: {
          name: "cursor",
          scopeId: "cursor" as never,
          data: { point: { x: 0.25, y: 0.75 } },
        },
      });
    });

    expect(view.result().selectors.remoteCursors).toEqual([
      { participantId: "p1", point: { x: 0.25, y: 0.75 } },
    ]);
    // presentCursors is parameterized: filters against the supplied roster.
    expect(view.result().selectors.presentCursors([])).toEqual([]);
    expect(view.result().selectors.presentCursors(["p1"])).toHaveLength(1);
    view.unmount();
  });
});
