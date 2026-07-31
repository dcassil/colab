/**
 * The generic remote-cursor UI layer: `<RemoteCursors>` (render) +
 * `useCursorCapture` (local pointer capture). Presentation-only and
 * transform-agnostic — the coordinate `transform` seam is the sole route for
 * screen-space knowledge; no iframe/CMS/geometry logic lives here.
 */
export { RemoteCursors } from "./RemoteCursors.js";
export type {
  RemoteCursorsProps,
  RemoteCursorRenderArgs,
} from "./RemoteCursors.js";
export { useCursorCapture } from "./useCursorCapture.js";
