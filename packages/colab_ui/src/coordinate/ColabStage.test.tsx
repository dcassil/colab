// @vitest-environment jsdom
import { useEffect } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ColabStage, useColabStage } from "./index.js";
import type { Point, StageBox } from "./index.js";

const originalResizeObserver = globalThis.ResizeObserver;

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(): void {
    return undefined;
  }

  unobserve(): void {
    return undefined;
  }

  disconnect(): void {
    return undefined;
  }

  trigger(): void {
    this.callback([], this);
  }
}

function toRect(box: StageBox): DOMRect {
  return {
    x: box.left,
    y: box.top,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => ({}),
  };
}

function stubRect(element: Element, box: StageBox): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => toRect(box),
  });
}

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

beforeEach(() => {
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver;
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalResizeObserver;
});

describe("ColabStage pointer samples", () => {
  it("normalizes local pointer samples and clamps them to 0-1 space", () => {
    const samples: Point[] = [];

    function Probe(): null {
      const stage = useColabStage();
      useEffect(() => stage.samples.subscribe((point) => samples.push(point)), [stage]);
      return null;
    }

    const view = render(
      <ColabStage data-testid="stage">
        <Probe />
      </ColabStage>,
    );
    const stage = view.getByTestId("stage");
    stubRect(stage, { left: 100, top: 50, width: 200, height: 400 });

    dispatchPointerMove(stage, 200, 250);
    dispatchPointerMove(stage, 500, -10);

    expect(samples).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ]);
  });
});

describe("ColabStage box tracking", () => {
  it("updates the published stage box after ResizeObserver callbacks", () => {
    let observedBox: StageBox | null = null;
    let currentBox: StageBox = { left: 100, top: 50, width: 200, height: 400 };

    function Probe(): null {
      observedBox = useColabStage().box;
      return null;
    }

    const view = render(
      <ColabStage data-testid="stage">
        <Probe />
      </ColabStage>,
    );
    const stage = view.getByTestId("stage");
    stubRect(stage, currentBox);

    currentBox = { left: 100, top: 50, width: 400, height: 400 };
    stubRect(stage, currentBox);
    const observer = MockResizeObserver.instances.at(0);
    if (observer === undefined) {
      throw new Error("expected ColabStage to create a ResizeObserver");
    }

    act(() => {
      observer.trigger();
    });

    expect(observedBox).toEqual(currentBox);
  });
});
