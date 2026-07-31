import { describe, expect, it } from "vitest";

// The guard's pure matcher, shared with the CI `pnpm neutrality` script.
import {
  FORBIDDEN_TOKENS,
  findForbidden,
} from "../../../../scripts/neutrality-guard.mjs";

describe("neutrality guard matcher (NFR-001)", () => {
  it("passes clean, neutral source text (TC-001 unit)", () => {
    const clean = "export interface PointerPosition { x: number; y: number; }";
    expect(findForbidden(clean)).toEqual([]);
  });

  it("catches a seeded forbidden token with location (TC-002)", () => {
    const seeded = "line one\nconst el = document.querySelector('[data-cms]');";
    const hits = findForbidden(seeded);
    const tokens = hits.map((h) => h.token);
    // `data-cms` (and the substring `cms`) are both flagged on line 2.
    expect(tokens).toContain("data-cms");
    const dataCms = hits.find((h) => h.token === "data-cms");
    expect(dataCms?.line).toBe(2);
    expect(dataCms?.column).toBeGreaterThan(0);
  });

  it("does not false-positive on unrelated identifiers", () => {
    // `metrics` contains no whole-word `cms`; `homeostasis` no whole `host`.
    expect(findForbidden("const metrics = computeHomeostasis();")).toEqual([]);
  });

  it("documents a rationale for every forbidden token", () => {
    for (const entry of FORBIDDEN_TOKENS) {
      expect(entry.why.length).toBeGreaterThan(0);
    }
    expect(FORBIDDEN_TOKENS.map((t) => t.token)).toEqual(
      expect.arrayContaining(["cms", "data-cms", "iframe", "geometry", "host-layout"]),
    );
  });
});
