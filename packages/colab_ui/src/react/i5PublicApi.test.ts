/**
 * I5 public API surface tests (PROJ-T-0040).
 *
 * Asserts every I5 symbol resolves through the finalized `colab_ui` barrels as a
 * named export (values resolve at runtime; type-only exports are erased), and
 * that no adapter/iframe/CMS/`mapGeometry` symbol leaks into the public surface.
 */
import { describe, expect, it } from "vitest";

import * as core from "../index.js";
import * as react from "./index.js";

describe("I5 public exports resolve (TC-001)", () => {
  it("exposes the interaction factory + reference Cursor from the core barrel", () => {
    expect(typeof core.defineInteraction).toBe("function");
    expect(typeof core.createCursorInteraction).toBe("function");
    expect(core.CURSOR_TYPE).toBe("cursor");
    // The reference Cursor descriptor is a value with the factory shape.
    expect(core.Cursor.type).toBe("cursor");
    expect(typeof core.Cursor.reduce).toBe("function");
    expect(typeof core.Cursor.toMessage).toBe("function");
    // Coordinate seam re-confirmed on the public surface.
    expect(typeof core.ColabStage).toBe("function");
    expect(typeof core.identity).toBe("function");
    expect(core.identity({ x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });

  it("exposes Cursor + RemoteCursors + useCursorCapture from the react barrel", () => {
    expect(react.Cursor.type).toBe("cursor");
    expect(typeof react.RemoteCursors).toBe("function");
    expect(typeof react.useCursorCapture).toBe("function");
    expect(typeof react.ColabStage).toBe("function");
  });
});

describe("no adapter/iframe/CMS leak into the public surface (TC-003)", () => {
  it("exports no iframe/CMS/mapGeometry-named symbol", () => {
    const names = [...Object.keys(core), ...Object.keys(react)];
    const forbidden = /iframe|cms|mapgeometry|stardust|adapter/i;
    const leaked = names.filter((name) => forbidden.test(name));
    expect(leaked).toEqual([]);
  });
});
