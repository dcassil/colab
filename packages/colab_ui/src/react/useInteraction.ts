/**
 * `useInteraction` — typed `{ state, send }` access to one interaction.
 *
 * Generic over the I2 {@link Interaction} descriptor passed in, so `state` is
 * inferred as the descriptor's own state type `S` (no call-site annotation
 * needed). `state` is the interaction's current reduced slice, read through the
 * shared {@link useColabStore} primitive scoped to that interaction's store key,
 * so unrelated slice updates never re-render the consumer. `send` is the
 * minimal, honest surface the descriptor supports — `send(input)` maps a local
 * input via the descriptor's own `toMessage` and publishes it on the session
 * bus (which relays it to the transport) — and is BOUND ONCE per (session,
 * interaction) so its identity is stable across renders.
 *
 * Throws a descriptive, interaction-named error when the descriptor is not
 * registered on the active session, and the shared provider-missing error when
 * used outside a `<ColabProvider>`.
 */
import { useCallback, useMemo } from "react";

import type { Interaction } from "../contracts/interaction.js";
import { interactionKey } from "./storeKeys.js";
import { useColab } from "./useColab.js";
import { useColabStore } from "./useColabStore.js";

/** The bound action surface an interaction exposes to React consumers. */
export interface InteractionActions {
  /** Map `input` via the descriptor's `toMessage` and publish it. */
  send: (input: unknown) => void;
}

/** The value returned by {@link useInteraction}. */
export interface UseInteractionResult<S> extends InteractionActions {
  /** The interaction's current reduced state, or `undefined` before first fold. */
  state: S | undefined;
}

/**
 * Read `interaction`'s state slice and bound sender from the active session.
 *
 * @throws when the interaction is not registered, or when used outside a
 *   `<ColabProvider>`.
 */
export function useInteraction<S>(
  interaction: Interaction<S>,
): UseInteractionResult<S> {
  const session = useColab();

  // Registry lookup — a clear, interaction-named error beats an undefined read.
  const registered = session.registry.get(interaction.type);
  if (registered === undefined) {
    throw new Error(
      `useInteraction: interaction "${interaction.type}" is not registered ` +
        `on this <ColabProvider>. Pass it via the provider's \`interactions\` prop.`,
    );
  }

  const key = interactionKey(interaction.type);
  const selector = useCallback((raw: unknown): S | undefined => raw as S | undefined, []);
  const state = useColabStore(key, selector);

  // Bound once per (session, interaction): stable action identity.
  const send = useCallback(
    (input: unknown): void => {
      session.bus.publish(interaction.toMessage(input));
    },
    [session, interaction],
  );

  return useMemo<UseInteractionResult<S>>(() => ({ state, send }), [state, send]);
}
