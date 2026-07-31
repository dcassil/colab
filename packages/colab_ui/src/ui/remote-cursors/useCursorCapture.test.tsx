// @vitest-environment jsdom
/**
 * `useCursorCapture` integration test (PROJ-T-0031).
 *
 * Verifies the local-capture hook subscribes to the `<ColabStage>` normalized
 * pointer stream and dispatches samples through `useInteraction(Cursor)`, which
 * relays a throttled `cursor` message to the transport. Rapid synthetic pointer
 * moves under fake timers assert the outbound throttle (TC-004) end to end.
 */
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS } from "colab-protocol";
import type { Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../../__tests__/fakes.js";
import { ColabStage } from "../../coordinate/index.js";
import { Cursor } from "../../interactions/cursor/cursor.js";
import { ColabProvider } from "../../react/ColabProvider.js";
import { useCursorCapture } from "./useCursorCapture.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };

describe("useCursorCapture — throttled dispatch through the stage (TC-004)", () => {
  it("coalesces rapid pointer samples into a single relayed cursor message", () => {
    vi.useFakeTimers();
    const transport = createFakeTransport();

    function Capture(): null {
      useCursorCapture();
      return null;
    }

    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={transport}
        store={createFakeStore()}
        interactions={[Cursor]}
      >
        <ColabStage data-testid="stage">
          <Capture />
        </ColabStage>
      </ColabProvider>,
    );

    const stage = view.getByTestId("stage");
    act(() => {
      for (let i = 0; i < 8; i += 1) {
        fireEvent.pointerMove(stage, { clientX: 10 + i, clientY: 20 + i });
      }
    });

    const before = transport.sent.filter(
      (m) => m.type === COLAB_EVENTS.INTERACTION,
    );
    expect(before).toHaveLength(0); // trailing edge — nothing relayed yet

    act(() => {
      vi.advanceTimersByTime(50);
    });

    const relayed = transport.sent.filter(
      (m) => m.type === COLAB_EVENTS.INTERACTION,
    );
    expect(relayed).toHaveLength(1);
    expect(relayed[0]?.from).toBe("me");
    view.unmount();
    vi.useRealTimers();
  });
});
