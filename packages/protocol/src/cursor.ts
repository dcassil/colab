/**
 * `NormalizedPoint` — a neutral 2-D point whose recommended interpretation is
 * an anchor-relative 0..1 coordinate. Protocol does not clamp or transform it.
 */
export interface NormalizedPoint {
  /** Horizontal coordinate. Recommended convention: 0..1. */
  x: number;
  /** Vertical coordinate. Recommended convention: 0..1. */
  y: number;
}

/** Literal action carried by cursor interaction data when a cursor disappears. */
export const CURSOR_GONE_ACTION = "gone";

/** Cursor interaction data carrying a visible point. */
export interface CursorPointData {
  point: NormalizedPoint;
}

/** Cursor interaction data signaling that the sender has no visible cursor. */
export interface CursorGoneData {
  action: typeof CURSOR_GONE_ACTION;
}

/** Structured-clone-safe data shapes used by the reference cursor interaction. */
export type CursorData = CursorPointData | CursorGoneData;
