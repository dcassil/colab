/**
 * `<RemoteCursors>` — the generic, geometry-free remote-cursor layer (I5 Phase D).
 *
 * Reads the reconciled `presentCursors` selector via `useInteraction(Cursor)`
 * (T3), the render-only `transform` seam + the current stage box from context
 * (T2/I4), and the roster identity (name/color) via `usePresence` + the local
 * identity on context. It renders ONE absolutely-positioned node per REMOTE
 * participant at `transform(point) * stageBox` — the ONLY screen-space math in
 * the whole cursor chain. The local participant is always excluded.
 *
 * TRANSFORM-AGNOSTIC: interactions store/emit RAW normalized points; the
 * transform is applied here and nowhere else. A scaled/iframe consumer changes
 * nothing but the supplied `transform` — no geometry/iframe/CMS logic lives here.
 *
 * A `renderCursor?` render-prop lets a design system fully own the visual; the
 * default is an unstyled pointer glyph + a colored name pill (minimal inline
 * positioning styles + className hooks, no CSS-framework dependency).
 */
import type { CSSProperties, ReactNode } from "react";

import { useColabStage } from "../../coordinate/index.js";
import type { Point } from "../../coordinate/index.js";
import { Cursor } from "../../interactions/cursor/cursor.js";
import { useColabContextValue } from "../../react/useColabContext.js";
import { useInteraction } from "../../react/useInteraction.js";
import { usePresence } from "../../react/usePresence.js";

/** Identity a consumer's `renderCursor` receives for one remote cursor. */
export interface RemoteCursorRenderArgs {
  /** The remote participant's stable id. */
  participantId: string;
  /** Display name from the roster (falls back to the id). */
  name: string;
  /** Display color from the roster (falls back to a neutral gray). */
  color: string;
  /** Pixel offset within the stage box: `transform(point) * box`. */
  position: { left: number; top: number };
  /** The raw normalized point (pre-transform), for advanced consumers. */
  point: Point;
}

/** Props for {@link RemoteCursors}. */
export interface RemoteCursorsProps {
  /** Override the default cursor visual; receives per-cursor identity+position. */
  renderCursor?: (args: RemoteCursorRenderArgs) => ReactNode;
  /** Optional className on the absolutely-positioned wrapper for each cursor. */
  className?: string;
}

const FALLBACK_COLOR = "#888";

function wrapperStyle(left: number, top: number): CSSProperties {
  return {
    position: "absolute",
    left,
    top,
    pointerEvents: "none",
    transform: "translate(-1px, -1px)",
  };
}

function pillStyle(color: string): CSSProperties {
  return {
    position: "absolute",
    left: 8,
    top: 8,
    padding: "1px 6px",
    borderRadius: 4,
    background: color,
    color: "#fff",
    fontSize: 11,
    whiteSpace: "nowrap",
  };
}

function DefaultCursor(args: RemoteCursorRenderArgs): ReactNode {
  return (
    <>
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        aria-hidden
        style={{ display: "block", fill: args.color }}
      >
        <path d="M1 1 L1 12 L4 9 L6.5 14 L8.5 13 L6 8 L10 8 Z" />
      </svg>
      <span style={pillStyle(args.color)}>{args.name}</span>
    </>
  );
}

/**
 * Render the remote participants' cursors positioned within the enclosing
 * `<ColabStage>`. Renders nothing until the stage box is measured.
 */
export function RemoteCursors(props: RemoteCursorsProps): ReactNode {
  const { renderCursor, className } = props;
  const { transform, identity } = useColabContextValue("RemoteCursors");
  const { box } = useColabStage();
  const roster = usePresence();
  const { selectors } = useInteraction(Cursor);

  if (box === null) return null;

  const presentIds = roster.map((participant) => participant.id);
  const cursors = selectors.presentCursors(presentIds);

  const nameOf = (id: string): string =>
    roster.find((participant) => participant.id === id)?.name ?? id;
  const colorOf = (id: string): string =>
    roster.find((participant) => participant.id === id)?.color ?? FALLBACK_COLOR;

  return (
    <>
      {cursors
        .filter((entry) => entry.participantId !== identity.id)
        .map((entry) => {
          const screen = transform(entry.point);
          const left = screen.x * box.width;
          const top = screen.y * box.height;
          const args: RemoteCursorRenderArgs = {
            participantId: entry.participantId,
            name: nameOf(entry.participantId),
            color: colorOf(entry.participantId),
            position: { left, top },
            point: entry.point,
          };
          return (
            <div
              key={entry.participantId}
              className={className}
              data-colab-cursor={entry.participantId}
              style={wrapperStyle(left, top)}
            >
              {renderCursor ? renderCursor(args) : DefaultCursor(args)}
            </div>
          );
        })}
    </>
  );
}
