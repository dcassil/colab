// @vitest-environment jsdom
/**
 * I5 universality proof (PROJ-T-0044) — the whole-initiative validation gate.
 *
 * Every assertion maps to a vision Success Criterion:
 *  (SC-custom)  A trivial CUSTOM interaction is authored purely through the
 *               public `defineInteraction` factory — NO colab core file edited,
 *               nothing subclassed — and driven via `useInteraction`.
 *  (SC-cursors) Two clients sharing an in-memory bus propagate a cursor: A's
 *               normalized pointer appears in B's `remoteCursors` and renders via
 *               `<RemoteCursors>` over the IDENTITY transform with ZERO
 *               coordinate configuration and no CMS/iframe/adapter present.
 *  (SC-seam)    Re-run with a provider-supplied NON-IDENTITY transform renders
 *               at transformed positions while stored/emitted points stay
 *               normalized — the seam is overridable in a test without forking.
 *  (SC-bounds)  Rapid synthetic pointer samples publish at a bounded outbound
 *               rate (≤ ~20/s at the 50ms throttle); departed participants are
 *               reconciled out of the rendered set (no unbounded growth).
 *
 * Everything is imported through the finalized PUBLIC exports only — proving the
 * external-author story. jsdom + Vitest; no real socket/server.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
// fireEvent retained for the throttle test; pointer coords need a hand-built
// event because jsdom's synthetic PointerEvent drops clientX/clientY.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS, asScopeId } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

// PUBLIC surface only (no deep internal paths) — the external-author contract.
import {
  ColabProvider,
  ColabStage,
  Cursor,
  RemoteCursors,
  useCursorCapture,
  useInteraction,
} from "../react/index.js";
import {
  createHub,
  createInMemoryTransport,
  defineInteraction,
} from "../index.js";

const A: Identity = { id: "A", name: "Alice", color: "#f00" };
const B: Identity = { id: "B", name: "Bob", color: "#00f" };

const originalResizeObserver = globalThis.ResizeObserver;

/**
 * A ResizeObserver that fires its callback synchronously on `observe`, so a
 * mounted `<ColabStage>` measures its (stubbed) box immediately — B renders
 * cursors without needing a real layout pass.
 */
class SyncResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(): void {
    this.callback([], this);
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}

beforeEach(() => {
  globalThis.ResizeObserver = SyncResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  globalThis.ResizeObserver = originalResizeObserver;
});

/** A `<ColabStage>` fixed pixel box, so `getBoundingClientRect` is deterministic. */
function stubStageBox(width: number, height: number): void {
  const rect: DOMRect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  };
  Element.prototype.getBoundingClientRect = function rectFn(): DOMRect {
    return rect;
  };
}

/**
 * Dispatch a pointermove carrying real `clientX/Y` — jsdom's synthetic
 * PointerEvent drops pointer coordinates, so they are attached by hand.
 */
function dispatchPointerMove(
  element: Element,
  clientX: number,
  clientY: number,
): void {
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  fireEvent(element, event);
}

/** Broadcast a server-style roster join so a peer enters the other's roster. */
function announce(hub: ReturnType<typeof createHub>, room: string, id: Identity) {
  const joined: ColabMessage = {
    type: COLAB_SERVER_EVENTS.PARTICIPANT_JOINED,
    from: id.id,
    payload: id,
  };
  hub.broadcast(room, joined);
}

interface TwoClient {
  ARoot: HTMLElement;
  BRoot: HTMLElement;
  moveA: (clientX: number, clientY: number) => void;
  unmount: () => void;
}

/** Mount two providers on a shared hub; A captures, B renders. */
function mountTwoClient(transformB?: (p: { x: number; y: number }) => { x: number; y: number }): TwoClient {
  const hub = createHub();
  const room = "proof";
  const transportA = createInMemoryTransport({ hub, room, identity: A });
  const transportB = createInMemoryTransport({ hub, room, identity: B });

  function ACapture(): null {
    useCursorCapture();
    return null;
  }

  const viewA = render(
    <ColabProvider serverUrl="mem://" room={room} identity={A} transport={transportA} interactions={[Cursor]}>
      <ColabStage data-testid="stageA">
        <ACapture />
      </ColabStage>
    </ColabProvider>,
  );
  const viewB = render(
    <ColabProvider
      serverUrl="mem://"
      room={room}
      identity={B}
      transport={transportB}
      interactions={[Cursor]}
      {...(transformB !== undefined ? { transform: transformB } : {})}
    >
      <ColabStage data-testid="stageB">
        <RemoteCursors />
      </ColabStage>
    </ColabProvider>,
  );

  // B learns A is present (server roster echo double).
  act(() => {
    announce(hub, room, A);
  });

  const stageA = viewA.container.querySelector<HTMLElement>(
    '[data-testid="stageA"]',
  );
  if (stageA === null) throw new Error("stageA not mounted");
  return {
    ARoot: viewA.container,
    BRoot: viewB.container,
    moveA: (clientX, clientY) => {
      dispatchPointerMove(stageA, clientX, clientY);
    },
    unmount: () => {
      viewA.unmount();
      viewB.unmount();
    },
  };
}

function cursorNode(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-colab-cursor="${id}"]`);
}

describe("TC-001 — custom interaction authored via the public factory", () => {
  it("drives a card-drag interaction with no core edits, no subclass", () => {
    interface DragState {
      positions: Record<string, { x: number; y: number } | undefined>;
    }
    // Authored ENTIRELY through the public `defineInteraction` — the same shape
    // the reference Cursor uses. No colab core file is touched.
    const cardDrag = defineInteraction<DragState, { x: number; y: number }>({
      type: "card-drag",
      initialState: { positions: {} },
      throttle: 50,
      reduce: (state, message): DragState => {
        const data = message.payload as { data?: { at?: { x: number; y: number } } };
        const at = data.data?.at;
        if (at === undefined) return state;
        return { positions: { ...state.positions, [message.from]: at } };
      },
      toMessage: (at): ColabMessage => ({
        type: COLAB_EVENTS.INTERACTION,
        from: "",
        payload: { name: "card-drag", scopeId: asScopeId("card"), data: { at } },
      }),
      selectors: {
        positionOf: (state) => (id: string) => state.positions[id],
      },
    });

    const hub = createHub();
    const transport = createInMemoryTransport({ hub, room: "cd", identity: A });
    let result: ReturnType<typeof useInteraction<DragState>> | undefined;
    function Reader(): null {
      result = useInteraction(cardDrag);
      return null;
    }
    const view = render(
      <ColabProvider serverUrl="mem://" room="cd" identity={A} transport={transport} interactions={[cardDrag]}>
        <Reader />
      </ColabProvider>,
    );

    // Seeded initialState is visible before any fold.
    expect(result?.state).toEqual({ positions: {} });

    // Feed a synthetic inbound message → reduce folds it, selector reflects it.
    act(() => {
      hub.broadcast("cd", {
        type: COLAB_SERVER_EVENTS.INTERACTION,
        from: "peer",
        payload: {
          name: "card-drag",
          scopeId: asScopeId("card"),
          data: { at: { x: 5, y: 6 } },
        },
      });
    });
    const positionOf = result?.selectors.positionOf as
      | ((id: string) => { x: number; y: number } | undefined)
      | undefined;
    expect(positionOf?.("peer")).toEqual({ x: 5, y: 6 });
    view.unmount();
  });
});

describe("TC-002 — two-client cursor propagation over identity", () => {
  it("A's pointer appears in B's RemoteCursors at identity(point)*box", () => {
    vi.useFakeTimers();
    stubStageBox(200, 400);
    const two = mountTwoClient();

    act(() => {
      // clientX/Y over a 200x400 box → normalized (0.25, 0.5).
      two.moveA(50, 200);
      vi.advanceTimersByTime(50); // flush the 50ms trailing-edge throttle
    });

    const node = cursorNode(two.BRoot, "A");
    expect(node).not.toBeNull();
    // identity transform: 0.25*200 = 50, 0.5*400 = 200. Self (B) is excluded.
    expect(node?.style.left).toBe("50px");
    expect(node?.style.top).toBe("200px");
    expect(cursorNode(two.BRoot, "B")).toBeNull();
    two.unmount();
  });
});

describe("TC-003 — transform override without forking", () => {
  it("renders at the half-scale position; emitted points stay normalized", () => {
    vi.useFakeTimers();
    stubStageBox(200, 400);
    const two = mountTwoClient((p) => ({ x: p.x * 0.5, y: p.y * 0.5 }));

    act(() => {
      two.moveA(50, 200); // normalized (0.25, 0.5)
      vi.advanceTimersByTime(50);
    });

    const node = cursorNode(two.BRoot, "A");
    // Half-scale: (0.25*0.5)*200 = 25, (0.5*0.5)*400 = 100.
    expect(node?.style.left).toBe("25px");
    expect(node?.style.top).toBe("100px");
    two.unmount();
  });
});

describe("TC-004 — bounded outbound rate + reconciled growth", () => {
  it("throttles rapid samples and prunes a departed participant", () => {
    vi.useFakeTimers();
    stubStageBox(200, 400);

    const hub = createHub();
    const room = "bounds";
    const transportA = createInMemoryTransport({ hub, room, identity: A });
    const sentByA: ColabMessage[] = [];
    const origSend = transportA.send.bind(transportA);
    transportA.send = (m): void => {
      if (m.type === COLAB_EVENTS.INTERACTION) sentByA.push(m);
      origSend(m);
    };

    function ACapture(): null {
      useCursorCapture();
      return null;
    }
    const viewA = render(
      <ColabProvider serverUrl="mem://" room={room} identity={A} transport={transportA} interactions={[Cursor]}>
        <ColabStage data-testid="stage">
          <ACapture />
        </ColabStage>
      </ColabProvider>,
    );
    const stage = viewA.container.querySelector<HTMLElement>(
      '[data-testid="stage"]',
    );
    if (stage === null) throw new Error("stage not mounted");

    // 20 samples inside a single 50ms window → ≤1 relayed (trailing edge).
    act(() => {
      for (let i = 0; i < 20; i += 1) {
        dispatchPointerMove(stage, i, i);
      }
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(sentByA).toHaveLength(1); // ~20/s bound at 50ms throttle
    viewA.unmount();

    // Reconciliation: with A absent from the roster, B renders nothing for A.
    const transportB = createInMemoryTransport({ hub, room, identity: B });
    const viewB = render(
      <ColabProvider serverUrl="mem://" room={room} identity={B} transport={transportB} interactions={[Cursor]}>
        <ColabStage data-testid="stageB">
          <RemoteCursors />
        </ColabStage>
      </ColabProvider>,
    );
    // Deliver A's cursor state to B, but never announce A into B's roster →
    // presentCursors reconciles A out (no unbounded stale growth).
    act(() => {
      hub.broadcast(room, {
        type: COLAB_SERVER_EVENTS.INTERACTION,
        from: "A",
        payload: {
          name: "cursor",
          scopeId: asScopeId("cursor"),
          data: { point: { x: 0.5, y: 0.5 } },
        },
      });
    });
    expect(cursorNode(viewB.container, "A")).toBeNull();
    viewB.unmount();
  });
});
