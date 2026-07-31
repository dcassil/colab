/**
 * `InteractionDescriptor<State, LocalEvent>` — the authored shape of one
 * collaborative behavior, produced by {@link defineInteraction}.
 *
 * An interaction is a plain descriptor of PURE functions — a reducer, a
 * message-mapper, and optional selectors — that a consumer authors WITHOUT
 * touching colab internals or subclassing anything. It is a strict, generically
 * typed refinement of I2's neutral {@link Interaction} seam:
 *  - `reduce(state, message)` folds an inbound {@link ColabMessage} into the
 *    interaction's private `State` (pure; returns a NEW state, never mutates).
 *  - `toMessage(localEvent)` maps a local `LocalEvent` into an outbound
 *    {@link ColabMessage} (pure; no transport, no DOM).
 *  - `initialState` seeds a fresh copy per active interaction instance.
 *  - `throttle` (optional) coalesces outbound publishes trailing-edge.
 *  - `selectors` (optional) derive read-only views of `State`. A selector MAY
 *    return a function to support the PARAMETERIZED form
 *    (e.g. `isLocked: (state) => (scopeId: string) => boolean`).
 *
 * These functions are PURE: no DOM, no geometry, no colab internals, no
 * transport. Lifecycle (instantiation, subscription, throttling, publishing,
 * selector surfacing) lives in I4's `useInteraction`, per {@link file://./CONTRACT.md}.
 */
import type { ColabMessage } from "colab-protocol";

/** A map of named, pure selectors deriving read-only views of `State`. */
export type InteractionSelectors<State> = Record<
  string,
  (state: State) => unknown
>;

export interface InteractionDescriptor<
  State,
  LocalEvent,
  Selectors extends InteractionSelectors<State> = InteractionSelectors<State>,
> {
  /** Discriminator identifying this interaction kind (registry key). */
  type: string;
  /** The seed state for a fresh interaction instance. */
  initialState: State;
  /** Fold an inbound message into interaction state (pure; returns new state). */
  reduce(state: State, message: ColabMessage): State;
  /** Map a local event into an outbound message (pure). */
  toMessage(localEvent: LocalEvent): ColabMessage;
  /** Optional trailing-edge coalescing interval in ms for outbound publishes. */
  throttle?: number;
  /** Optional pure selectors; a selector may itself return a function. */
  selectors?: Selectors;
}
