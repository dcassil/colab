// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS } from "colab-protocol";
import type { ColabMessage, Identity } from "colab-protocol";

import { createFakeStore, createFakeTransport } from "../../__tests__/fakes.js";
import { Cursor } from "../../interactions/cursor/cursor.js";
import type { CursorPoint } from "../../interactions/cursor/cursor.js";
import { ColabProvider } from "../../react/ColabProvider.js";
import { useCursorSource } from "./useCursorSource.js";

const identity: Identity = { id: "me", name: "Me", color: "#fff" };
const CURSOR_GONE_ACTION_VALUE = "gone";

function isInteraction(
  message: ColabMessage,
): message is ColabMessage<typeof COLAB_EVENTS.INTERACTION> {
  return message.type === COLAB_EVENTS.INTERACTION;
}

describe("useCursorSource", () => {
  it("publishes points and sends gone when the source becomes null", () => {
    vi.useFakeTimers();
    const transport = createFakeTransport();
    const store = createFakeStore();
    const interactions = [Cursor];

    function Source(props: { point: CursorPoint | null }): null {
      useCursorSource(props.point);
      return null;
    }

    const view = render(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={transport}
        store={store}
        interactions={interactions}
      >
        <Source point={{ x: 0.25, y: 0.75 }} />
      </ColabProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    view.rerender(
      <ColabProvider
        serverUrl="https://relay.example"
        room="r"
        identity={identity}
        transport={transport}
        store={store}
        interactions={interactions}
      >
        <Source point={null} />
      </ColabProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });

    const relayed = transport.sent.filter(isInteraction);
    expect(relayed).toHaveLength(2);
    expect(relayed[0]?.payload.data).toEqual({ point: { x: 0.25, y: 0.75 } });
    expect(relayed[1]?.payload.data).toEqual({
      action: CURSOR_GONE_ACTION_VALUE,
    });
    view.unmount();
    vi.useRealTimers();
  });
});
