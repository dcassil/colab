import type { ColabMessage } from "colab-protocol";

/**
 * `Interaction<S>` — the seam describing one collaborative behavior.
 *
 * DECLARED CONTRACT ONLY. No concrete implementation ships from I2. This is the
 * neutral shape produced by I5's `defineInteraction` factory; the registry (T5)
 * and session (T6) route interaction messages through it without knowing any
 * concrete behavior.
 *
 * An `Interaction` is generic over its private state `S` (defaulting to
 * `unknown`) so concrete interactions retain their state type end to end:
 *  - `reduce` folds an inbound {@link ColabMessage} into interaction state.
 *  - `toMessage` maps a local input into an outbound {@link ColabMessage}.
 *
 * ADDITIVELY EXTENSIBLE: of the three seams this is the one most likely to gain
 * further optional fields in later initiatives (e.g. lifecycle hooks). Consumers
 * and implementors must treat new members as additive; the members declared
 * here are the stable minimum I5's factory guarantees.
 */
export interface Interaction<S = unknown> {
  /** Discriminator identifying this interaction kind. */
  type: string;
  /** Fold an inbound message into the interaction's state. */
  reduce(state: S, message: ColabMessage): S;
  /** Map a local input into an outbound message. */
  toMessage(input: unknown): ColabMessage;
}
