/**
 * Renders the custom `reactionPing` interaction: a trigger button and the
 * transient markers every tab shows when anyone pings.
 *
 * The whole behavior is driven by the CUSTOM interaction authored in
 * `../interactions/reactionPing` — this component only (a) calls `send` to emit
 * a ping and (b) reads `selectors.active(now)` to render the not-yet-expired
 * markers. A local clock ticks so expired pings drop out in every tab (the
 * interaction's TTL lives in the payload; `reduce` stays pure). Emitting in one
 * tab therefore shows the marker in BOTH tabs, then clears — the cross-tab
 * extensibility proof.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useColabStage, useInteraction } from "colab-ui/react";

import { reactionPing } from "../interactions/reactionPing.js";

/** How long a ping stays visible, in ms. */
const PING_TTL_MS = 2000;

function newId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ping-${String(Math.random()).slice(2)}`;
}

/** A ticking clock so `active(now)` re-evaluates and expired pings vanish. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

export function PingLayer(): ReactElement {
  const { box } = useColabStage();
  const { send, selectors } = useInteraction(reactionPing);
  const now = useNow(250);
  const active = selectors.active(now);

  return (
    <>
      <button
        type="button"
        data-testid="ping-button"
        onClick={() => {
          // Ping the centre of the stage — deterministic for the e2e.
          send({ id: newId(), x: 0.5, y: 0.5, expiresAt: Date.now() + PING_TTL_MS });
        }}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #4f46e5",
          background: "#eef2ff",
          color: "#3730a3",
          cursor: "pointer",
        }}
      >
        Send ping ✨
      </button>
      {box === null
        ? null
        : active.map((ping) => (
            <span
              key={ping.id}
              data-testid="ping-marker"
              data-ping-from={ping.from}
              style={{
                position: "absolute",
                left: ping.x * box.width,
                top: ping.y * box.height,
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                borderRadius: "50%",
                border: "2px solid #4f46e5",
                background: "rgba(79, 70, 229, 0.25)",
                pointerEvents: "none",
              }}
            />
          ))}
    </>
  );
}
