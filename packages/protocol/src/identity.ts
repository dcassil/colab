import type { JsonValue } from "./json.js";

/**
 * `Identity` — who a client claims to be when it connects.
 *
 * The self-asserted identity a client presents at join time. Neutral by
 * construction: just an id, a display `name`, a display `color`, and an
 * optional open `extra` bag constrained to structured-clone-safe values.
 *
 * NOTE: an auth token is intentionally NOT part of `Identity`. Credentials are
 * passed separately at connect time and are out of scope for the wire types.
 */
export interface Identity {
  /** Stable unique id for this participant; used as `ColabMessage.from`. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Display color (e.g. a hex string); interpretation is the consumer's. */
  color: string;
  /** Optional consumer-defined metadata; must be structured-clone-safe. */
  extra?: Record<string, JsonValue>;
}

/**
 * `Participant` — an entry in the observed roster.
 *
 * The shape another peer sees for a joined member. Structurally identical to
 * {@link Identity} today (id / name / color / optional `extra`), but kept as a
 * distinct type because the two evolve independently: `Identity` is *asserted*
 * by the owner at connect; `Participant` is *observed* from the roster and may
 * later carry server-derived fields. `extra` is the pluggable, consumer-defined
 * field for presence metadata.
 */
export interface Participant {
  /** The participant's stable unique id (matches its `Identity.id`). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Display color. */
  color: string;
  /** Optional consumer-defined metadata; must be structured-clone-safe. */
  extra?: Record<string, JsonValue>;
}
