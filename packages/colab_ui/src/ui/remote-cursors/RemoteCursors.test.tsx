// @vitest-environment jsdom
/**
 * `<RemoteCursors>` UI tests (PROJ-T-0035).
 *
 * Renders the component with stubbed selector / stage box / transform / roster /
 * identity via module mocks, so positioning, self-exclusion, roster labeling,
 * and the `renderCursor` render-prop are asserted in isolation (no live
 * transport). Screen-space math is the only geometry: `transform(point) * box`.
 */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Identity, Participant } from "colab-protocol";

import type { Point, StageBox, Transform } from "../../coordinate/index.js";
import type { RemoteCursorEntry } from "../../interactions/cursor/cursor.js";

// ── Controllable stubs for every seam the component reads ──────────────────────
let box: StageBox | null = { left: 0, top: 0, width: 200, height: 400 };
let transform: Transform = (p) => p;
let identity: Identity = { id: "self", name: "Me", color: "#000" };
let roster: readonly Participant[] = [];
let entries: RemoteCursorEntry[] = [];

vi.mock("../../coordinate/index.js", () => ({
  useColabStage: () => ({ box, samples: { subscribe: () => () => undefined } }),
}));
vi.mock("../../react/useColabContext.js", () => ({
  useColabContextValue: () => ({ transform, identity }),
}));
vi.mock("../../react/usePresence.js", () => ({
  usePresence: () => roster,
}));
vi.mock("../../react/useInteraction.js", () => ({
  useInteraction: () => ({
    state: {},
    send: () => undefined,
    selectors: {
      presentCursors: (presentIds: readonly string[]) =>
        entries.filter((e) => presentIds.includes(e.participantId)),
    },
  }),
}));

// Import AFTER mocks are declared.
const { RemoteCursors } = await import("./RemoteCursors.js");

function point(x: number, y: number): Point {
  return { x, y };
}

/** Query a single cursor node, asserting it exists (narrows away null). */
function cursorNode(root: HTMLElement, id?: string): HTMLElement {
  const selector = id === undefined
    ? "[data-colab-cursor]"
    : `[data-colab-cursor="${id}"]`;
  const node = root.querySelector<HTMLElement>(selector);
  if (node === null) throw new Error(`no cursor node for ${selector}`);
  return node;
}

beforeEach(() => {
  box = { left: 0, top: 0, width: 200, height: 400 };
  transform = (p) => p;
  identity = { id: "self", name: "Me", color: "#000" };
  roster = [];
  entries = [];
});

describe("RemoteCursors — identity render + self exclusion (TC-001)", () => {
  it("renders only remote cursors at transform(point) * box", () => {
    identity = { id: "self", name: "Me", color: "#000" };
    roster = [
      { id: "self", name: "Me", color: "#000" },
      { id: "p2", name: "P2", color: "#0f0" },
    ];
    entries = [
      { participantId: "self", point: point(0.5, 0.5) },
      { participantId: "p2", point: point(0.25, 0.5) },
    ];

    const view = render(<RemoteCursors />);
    const nodes =
      view.container.querySelectorAll<HTMLElement>("[data-colab-cursor]");
    expect(nodes).toHaveLength(1);
    const node = cursorNode(view.container, "p2");
    expect(node.getAttribute("data-colab-cursor")).toBe("p2");
    // 0.25*200 = 50, 0.5*400 = 200.
    expect(node.style.left).toBe("50px");
    expect(node.style.top).toBe("200px");
  });
});

describe("RemoteCursors — non-identity transform moves position (TC-002)", () => {
  it("applies the supplied transform at render only", () => {
    box = { left: 0, top: 0, width: 100, height: 100 };
    transform = (p) => ({ x: p.x * 0.5, y: p.y * 0.5 });
    roster = [{ id: "p2", name: "P2", color: "#0f0" }];
    entries = [{ participantId: "p2", point: point(0.4, 0.6) }];

    const view = render(<RemoteCursors />);
    const node = cursorNode(view.container);
    // 0.4*0.5*100 = 20, 0.6*0.5*100 = 30.
    expect(node.style.left).toBe("20px");
    expect(node.style.top).toBe("30px");
  });
});

describe("RemoteCursors — renderCursor render-prop + roster labeling (TC-003)", () => {
  it("uses the custom render-prop when provided", () => {
    roster = [{ id: "p2", name: "Alice", color: "#f00" }];
    entries = [{ participantId: "p2", point: point(0.5, 0.5) }];

    const view = render(
      <RemoteCursors
        renderCursor={(args) => (
          <span data-testid="custom">{`${args.name}:${args.color}`}</span>
        )}
      />,
    );
    expect(view.getByTestId("custom").textContent).toBe("Alice:#f00");
  });

  it("labels the default cursor with roster name + color", () => {
    roster = [{ id: "p2", name: "Alice", color: "#f00" }];
    entries = [{ participantId: "p2", point: point(0.5, 0.5) }];

    const view = render(<RemoteCursors />);
    const pill = view.getByText("Alice");
    expect(pill).toBeTruthy();
    expect(pill.getAttribute("style")).toContain("rgb(255, 0, 0)");
  });
});
