/**
 * `Cursor` — the reference cursor interaction (I5 Phase C).
 *
 * Authored PURELY through the T1 {@link defineInteraction} factory with the
 * exact descriptor shape any external consumer would use — no colab-internal
 * imports, no subclassing, no DOM/geometry. It is one half of the "interactions
 * are the extension point" proof.
 *
 * STATE is a map of participant id → their latest NORMALIZED (0–1) pointer
 * {@link Point}. `reduce` folds an inbound `cursor` message by keying the
 * sender's `from` id to the payload point (immutably). `toMessage` emits a
 * normalized-point `cursor` message and applies NO transform — the wire stays
 * canonical; screen-space math lives only in the render layer (T5).
 *
 * SELECTORS:
 *  - `remoteCursors(state)` → `{ participantId, point }[]` for every known id.
 *  - `presentCursors(state)` → `(presentIds) => {...}[]` — the parameterized
 *    reconciliation form: filters to currently-present participants so state
 *    does not grow unbounded (preferred over trusting a server leave message).
 *
 * `throttle: 50` bounds outbound publishing to ~≤20 msg/s/participant (the hook
 * enforces the trailing-edge coalescing per the lifecycle contract).
 */
import {
  COLAB_EVENTS,
  asScopeId,
  createMessage,
} from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import { defineInteraction } from "../../interaction/index.js";
import type { InteractionRegistry } from "../../core/registry.js";

/** A normalized 0–1 point on the stage. Structurally the coordinate `Point`. */
export interface CursorPoint {
  x: number;
  y: number;
}

/** Local cursor event: a point when visible, or `null` when absent/gone. */
export type CursorEvent = CursorPoint | null;

/** Cursor interaction state: participant id → their latest normalized point. */
export type CursorState = Record<string, CursorPoint | undefined>;

/** One reconciled remote cursor entry surfaced by the selectors. */
export interface RemoteCursorEntry {
  participantId: string;
  point: CursorPoint;
}

/** The interaction kind discriminator (matched against `payload.name`). */
export const CURSOR_TYPE = "cursor";

/** The scope every cursor message targets — cursors are stage-global. */
const CURSOR_SCOPE = asScopeId("cursor");

/** Wire action matching colab-protocol's exported `CURSOR_GONE_ACTION`. */
const CURSOR_GONE_ACTION_VALUE = "gone";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCursorPoint(value: unknown): value is CursorPoint {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function omitParticipant(state: CursorState, participantId: string): CursorState {
  if (state[participantId] === undefined) return state;
  const next: CursorState = {};
  for (const [key, value] of Object.entries(state)) {
    if (key !== participantId) next[key] = value;
  }
  return next;
}

function entriesOf(state: CursorState): RemoteCursorEntry[] {
  const out: RemoteCursorEntry[] = [];
  for (const participantId of Object.keys(state)) {
    const point = state[participantId];
    if (point !== undefined) out.push({ participantId, point });
  }
  return out;
}

/**
 * The reference cursor interaction descriptor. Building it also registers it in
 * the process-wide default registry (dev duplicate-type guard); pass a registry
 * to target a specific session instead.
 */
export function createCursorInteraction(registry?: InteractionRegistry) {
  return defineInteraction<
    CursorState,
    CursorEvent,
    {
      remoteCursors: (state: CursorState) => RemoteCursorEntry[];
      presentCursors: (
        state: CursorState,
      ) => (presentIds: readonly string[]) => RemoteCursorEntry[];
    }
  >(
    {
      type: CURSOR_TYPE,
      initialState: {},
      throttle: 50,
      // Immutable, keyed by the sender's envelope `from`. Tolerates an unseeded
      // `undefined` prev (the mirror seeds slices lazily).
      reduce: (state, message): CursorState => {
        const payload = message.payload as { data?: unknown } | undefined;
        const data = payload?.data;
        if (!isRecord(data)) return state;
        if (data.action === CURSOR_GONE_ACTION_VALUE) {
          return omitParticipant(state, message.from);
        }
        const point = data.point;
        if (!isCursorPoint(point)) return state;
        return { ...state, [message.from]: point };
      },
      // Normalized point or explicit gone signal — NO transform applied.
      toMessage: (event): ColabMessage =>
        createMessage(COLAB_EVENTS.INTERACTION, "", {
          name: CURSOR_TYPE,
          scopeId: CURSOR_SCOPE,
          data:
            event === null
              ? { action: CURSOR_GONE_ACTION_VALUE }
              : { point: { x: event.x, y: event.y } },
        }),
      selectors: {
        remoteCursors: (state) => entriesOf(state),
        presentCursors: (state) => (presentIds) => {
          const present = new Set(presentIds);
          return entriesOf(state).filter((entry) =>
            present.has(entry.participantId),
          );
        },
      },
    },
    registry,
  );
}

/**
 * The reference cursor interaction, registered in the default registry at module
 * load. Consumers pass this to `<ColabProvider interactions>` and read it via
 * `useInteraction(Cursor)`.
 */
export const Cursor = createCursorInteraction();
