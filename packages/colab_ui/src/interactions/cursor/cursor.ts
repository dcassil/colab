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
import { COLAB_EVENTS, asScopeId, createMessage } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import { defineInteraction } from "../../interaction/index.js";
import type { InteractionRegistry } from "../../core/registry.js";

/** A normalized 0–1 point on the stage. Structurally the coordinate `Point`. */
export interface CursorPoint {
  x: number;
  y: number;
}

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
    CursorPoint,
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
        const payload = message.payload as
          | { data?: { point?: CursorPoint } }
          | undefined;
        const point = payload?.data?.point;
        if (point === undefined) return state;
        return { ...state, [message.from]: point };
      },
      // Normalized point only — NO transform applied (wire stays canonical).
      toMessage: (point): ColabMessage =>
        createMessage(COLAB_EVENTS.INTERACTION, "", {
          name: CURSOR_TYPE,
          scopeId: CURSOR_SCOPE,
          // Fresh JSON-safe literal (coords are numbers → valid `JsonValue`).
          data: { point: { x: point.x, y: point.y } },
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
