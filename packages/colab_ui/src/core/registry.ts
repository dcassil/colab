import type { Interaction } from "../contracts/interaction.js";

/**
 * `InteractionRegistry` — a keyed collection of {@link Interaction}s.
 *
 * The session (T6) uses it to route an inbound interaction message to the
 * interaction registered under its `type`, without knowing concrete behavior.
 * The registry is deliberately behavior-agnostic: it never calls `reduce` or
 * `toMessage`. It is populated by I5's `defineInteraction` output.
 *
 * Entries are stored as `Interaction` (state type erased to the `unknown`
 * default) because the collection is heterogeneous; the concrete state type is
 * recovered by the interaction's own closures, not by the registry.
 */
export interface InteractionRegistry {
  /**
   * Store `interaction` under its `type`.
   *
   * @throws {Error} naming the `type` if one is already registered.
   */
  register(interaction: Interaction): void;
  /** The interaction registered under `type`, or `undefined`. */
  get(type: string): Interaction | undefined;
  /** An immutable snapshot of all registered interactions. */
  list(): readonly Interaction[];
}

/**
 * Create an {@link InteractionRegistry}.
 *
 * Factory closing over a `Map<string, Interaction>` — no class, no `this`.
 */
export function createInteractionRegistry(): InteractionRegistry {
  const interactions = new Map<string, Interaction>();

  function register(interaction: Interaction): void {
    if (interactions.has(interaction.type)) {
      throw new Error(
        `InteractionRegistry: an interaction of type "${interaction.type}" is already registered`,
      );
    }
    interactions.set(interaction.type, interaction);
  }

  function get(type: string): Interaction | undefined {
    return interactions.get(type);
  }

  function list(): readonly Interaction[] {
    return [...interactions.values()];
  }

  return { register, get, list };
}
