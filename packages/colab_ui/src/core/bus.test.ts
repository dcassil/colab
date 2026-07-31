import { describe, expect, it, vi } from "vitest";

import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import type { ColabMessage, PointerPosition } from "colab-protocol";

import { createMessageBus } from "./bus.js";

const pointer = (x: number): ColabMessage<typeof COLAB_EVENTS.POINTER> =>
  createMessage(COLAB_EVENTS.POINTER, "u1", { x, y: 0 });

const interaction = (): ColabMessage<typeof COLAB_EVENTS.INTERACTION> =>
  createMessage(COLAB_EVENTS.INTERACTION, "u1", {
    name: "n",
    scopeId: asScopeId("s"),
  });

describe("MessageBus type-scoped dispatch (TC-001)", () => {
  it("delivers only to handlers of the published type", () => {
    const bus = createMessageBus();
    const a = vi.fn<(m: ColabMessage<typeof COLAB_EVENTS.POINTER>) => void>();
    const b = vi.fn();
    bus.subscribe(COLAB_EVENTS.POINTER, a);
    bus.subscribe(COLAB_EVENTS.INTERACTION, b);

    bus.publish(pointer(0.5));

    expect(a).toHaveBeenCalledTimes(1);
    const [firstCall] = a.mock.calls;
    if (firstCall === undefined) throw new Error("expected a call");
    const received: PointerPosition = firstCall[0].payload;
    expect(received.x).toBe(0.5);
    expect(b).not.toHaveBeenCalled();
  });
});

describe("MessageBus subscription semantics", () => {
  it("invokes multiple same-type handlers in registration order (TC + AC)", () => {
    const bus = createMessageBus();
    const order: string[] = [];
    bus.subscribe(COLAB_EVENTS.POINTER, () => order.push("first"));
    bus.subscribe(COLAB_EVENTS.POINTER, () => order.push("second"));

    bus.publish(pointer(1));

    expect(order).toEqual(["first", "second"]);
  });

  it("unsubscribe stops delivery to exactly that handler (TC-002)", () => {
    const bus = createMessageBus();
    const first = vi.fn();
    const second = vi.fn();
    const off = bus.subscribe(COLAB_EVENTS.POINTER, first);
    bus.subscribe(COLAB_EVENTS.POINTER, second);

    off();
    bus.publish(pointer(1));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clear() removes all handlers", () => {
    const bus = createMessageBus();
    const h = vi.fn();
    bus.subscribe(COLAB_EVENTS.POINTER, h);
    bus.clear();
    bus.publish(pointer(1));
    expect(h).not.toHaveBeenCalled();
  });
});

describe("MessageBus error isolation (AC)", () => {
  it("a throwing handler does not stop others; error routes to onError", () => {
    const onError = vi.fn();
    const bus = createMessageBus(onError);
    const survivor = vi.fn();
    bus.subscribe(COLAB_EVENTS.INTERACTION, () => {
      throw new Error("boom");
    });
    bus.subscribe(COLAB_EVENTS.INTERACTION, survivor);

    bus.publish(interaction());

    expect(survivor).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("the default reporter logs to the host console when present", () => {
    const host = globalThis as unknown as {
      console: { error: (...args: unknown[]) => void };
    };
    const original = host.console;
    const errorSpy = vi.fn();
    host.console = { error: errorSpy };
    try {
      const bus = createMessageBus();
      bus.subscribe(COLAB_EVENTS.POINTER, () => {
        throw new Error("boom");
      });
      bus.publish(pointer(1));
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      host.console = original;
    }
  });
});
