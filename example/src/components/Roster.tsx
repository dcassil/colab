/**
 * "Who's here" — the live roster of remote participants.
 *
 * Both pieces of presence come straight from colab: `<AvatarStack>` renders the
 * overlapping avatars, and `usePresence()` gives the same participant list as
 * data so we can show names beside the stack. The local participant is excluded
 * by colab's roster semantics, so this shows only the OTHER tabs.
 */
import type { ReactElement } from "react";

import { AvatarStack, usePresence } from "colab-ui/react";

export function Roster(): ReactElement {
  const participants = usePresence();

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8 }}
      data-testid="roster"
    >
      <AvatarStack max={5} size={28} />
      <span style={{ fontSize: 13, color: "#71717a" }}>
        {participants.length === 0
          ? "just you — open a second tab"
          : participants.map((participant) => participant.name).join(", ")}
      </span>
    </div>
  );
}
