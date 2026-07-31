/**
 * `useCursorCapture` — the local pointer-capture side of the cursor interaction.
 *
 * Subscribes to the enclosing `<ColabStage>`'s normalized pointer sample stream
 * (T2) and dispatches each sample through `useInteraction(Cursor)` (I4). It reads
 * NO DOM directly beyond the stage-provided normalized samples, and applies NO
 * transform — the wire stays canonical. The hook's outbound throttle is enforced
 * by `useInteraction` per the descriptor's `throttle: 50`.
 *
 * Mount it inside a `<ColabStage>` (and a `<ColabProvider>` with `Cursor`
 * registered) wherever local cursor sharing should be active.
 */
import { useEffect } from "react";

import { useColabStage } from "../../coordinate/index.js";
import { useInteraction } from "../../react/useInteraction.js";
import { Cursor } from "../../interactions/cursor/cursor.js";

/** Capture the local normalized pointer and publish it as a cursor sample. */
export function useCursorCapture(): void {
  const { samples } = useColabStage();
  const { send } = useInteraction(Cursor);

  useEffect(
    () =>
      samples.subscribe((point) => {
        send(point);
      }),
    [samples, send],
  );
}
