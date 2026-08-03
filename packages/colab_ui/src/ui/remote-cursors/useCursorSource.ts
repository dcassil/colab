import { useEffect } from "react";

import { Cursor } from "../../interactions/cursor/cursor.js";
import type { CursorPoint } from "../../interactions/cursor/cursor.js";
import { useInteraction } from "../../react/useInteraction.js";

/**
 * Publish a caller-owned normalized cursor source.
 *
 * A non-null point broadcasts cursor presence; `null` broadcasts the protocol
 * gone signal so remotes remove this participant's cursor.
 */
export function useCursorSource(point: CursorPoint | null): void {
  const { send } = useInteraction(Cursor);

  useEffect(() => {
    send(point);
  }, [point, send]);
}
