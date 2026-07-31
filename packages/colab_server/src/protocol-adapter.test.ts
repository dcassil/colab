import { describe, expect, it } from "vitest";

import { COLAB_EVENTS, COLAB_SERVER_EVENTS, createMessage } from "colab-protocol";

import { isRelayMessage, toServerRelayEvent } from "./protocol-adapter.js";

describe("protocol adapter", () => {
  it("maps opaque client relay events to server relay events", () => {
    expect(toServerRelayEvent(COLAB_EVENTS.POINTER)).toBe(
      COLAB_SERVER_EVENTS.POINTER,
    );
    expect(toServerRelayEvent(COLAB_EVENTS.INTERACTION)).toBe(
      COLAB_SERVER_EVENTS.INTERACTION,
    );
  });

  it("separates relay messages from presence messages", () => {
    const pointer = createMessage(COLAB_EVENTS.POINTER, "a", { x: 0.1, y: 0.2 });
    const leave = createMessage(COLAB_EVENTS.LEAVE, "a", { id: "a" });

    expect(isRelayMessage(pointer)).toBe(true);
    expect(isRelayMessage(leave)).toBe(false);
  });
});
