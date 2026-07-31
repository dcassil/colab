/**
 * The reference `Cursor` interaction (geometry/DOM-free). Authored purely via
 * the T1 `defineInteraction` factory; the local-capture hook and rendering live
 * in the UI layer (`ui/remote-cursors`), keeping this module transform-free.
 */
export {
  Cursor,
  createCursorInteraction,
  CURSOR_TYPE,
} from "./cursor.js";
export type {
  CursorPoint,
  CursorState,
  RemoteCursorEntry,
} from "./cursor.js";
