/** A canonical normalized point in stage-local 0-1 coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** Maps one normalized point to another for render-only screen-space seams. */
export type Transform = (point: Point) => Point;

/** Default render transform: canonical points pass through unchanged. */
export const identity: Transform = (point) => point;

/** The latest DOM box for a mounted `<ColabStage>`. */
export interface StageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Receives normalized pointer samples without forcing React re-renders. */
export type PointerSampleListener = (point: Point) => void;

/** Lightweight pointer sample stream for consumers such as cursors. */
export interface PointerSampleSource {
  subscribe(listener: PointerSampleListener): () => void;
}

/** Context value published by `<ColabStage>`. */
export interface ColabStageContextValue {
  box: StageBox | null;
  samples: PointerSampleSource;
}
