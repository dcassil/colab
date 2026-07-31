import type { ScopeId } from "./scope.js";

/**
 * `PointerPosition` — a neutral 2-D coordinate, optionally within a scope.
 *
 * NEUTRALITY CONTRACT: `protocol` holds NO transform, projection, or spatial
 * logic. `x` and `y` are plain numbers; their *interpretation* is entirely the
 * consumer's. The recommended default convention is that `x` and `y` are
 * anchor-relative fractions in the `0..1` range (so positions are resolution
 * independent), but the protocol neither enforces, clamps, nor transforms this
 * — it only carries the numbers. Any mapping to pixels, elements, or screen
 * space happens in consumer code, never here.
 *
 * When `scopeId` is present, the coordinate is understood to be relative to
 * that scope (see {@link ScopeId}); when absent, it is relative to whatever
 * default scope the consumer defines.
 */
export interface PointerPosition {
  /** Horizontal coordinate. Default interpretation: 0..1 anchor-relative. */
  x: number;
  /** Vertical coordinate. Default interpretation: 0..1 anchor-relative. */
  y: number;
  /** Optional scope this coordinate is relative to. */
  scopeId?: ScopeId;
}
