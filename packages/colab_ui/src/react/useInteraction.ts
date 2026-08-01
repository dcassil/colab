/**
 * `useInteraction` — typed `{ state, send, selectors }` access to one interaction.
 *
 * Generic over the descriptor passed in, so `state` is inferred as the
 * descriptor's own state type `S`. `state` is the interaction's current reduced
 * slice, read through the shared {@link useColabStore} primitive scoped to that
 * interaction's store key, so unrelated slice updates never re-render the
 * consumer.
 *
 * LIFECYCLE (per `interaction/CONTRACT.md`). The pure factory descriptor does
 * not drive itself; this hook honors the four responsibilities:
 *  1. FRESH `initialState` — when the descriptor carries an `initialState`, the
 *     slice is seeded from it (per active interaction), so `state` and selectors
 *     see a concrete value before the first inbound fold instead of `undefined`.
 *  2. INBOUND routing lives in the provider's `mirrorInteractions`, which folds
 *     every matching inbound `ColabMessage` through `reduce` (never throttled).
 *  3. OUTBOUND throttle — when the descriptor carries `throttle: N`, `send`
 *     coalesces publishes on the TRAILING edge to ≤1 per `N` ms (last wins);
 *     unset throttle publishes immediately.
 *  4. SELECTORS — when the descriptor carries `selectors`, each is surfaced
 *     computed against the current (seeded) state; a selector that returns a
 *     function (parameterized form) is surfaced as-is.
 *
 * `send(input)` maps a local input via the descriptor's own `toMessage` and
 * publishes it on the session bus (which relays it to the transport). Its
 * identity is stable across renders for a given (session, interaction).
 *
 * Throws a descriptive, interaction-named error when the descriptor is not
 * registered on the active session, and the shared provider-missing error when
 * used outside a `<ColabProvider>`.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ColabMessage } from "colab-protocol";

import type { Interaction } from "../contracts/interaction.js";
import type { InteractionSelectors } from "../interaction/descriptor.js";
import { interactionKey } from "./storeKeys.js";
import { useColabContextValue } from "./useColabContext.js";
import { useColabStore } from "./useColabStore.js";

/**
 * The lifecycle-aware descriptor `useInteraction` consumes. It is the neutral
 * I2 {@link Interaction} seam plus the OPTIONAL lifecycle fields the T1 factory
 * authors (`initialState`, `throttle`, `selectors`). Keeping them optional means
 * a bare `Interaction` still works (backward compatible), while a full
 * `InteractionDescriptor` lights up seeding, throttle, and selectors.
 */
export interface InteractionLifecycle<
  S,
  Sel extends InteractionSelectors<S> = InteractionSelectors<S>,
> extends Interaction<S> {
  /** Seed for a fresh slice; makes `state`/selectors concrete before first fold. */
  initialState?: S;
  /** Trailing-edge coalescing interval in ms for outbound publishes. */
  throttle?: number;
  /** Pure selectors deriving read-only views of state (may be parameterized). */
  selectors?: Sel;
}

/** The output shape of a descriptor's selectors bound to the current state. */
export type SelectorResults<S, Sel extends InteractionSelectors<S>> = {
  [K in keyof Sel]: ReturnType<Sel[K]>;
};

/** The bound action surface an interaction exposes to React consumers. */
export interface InteractionActions {
  /** Map `input` via the descriptor's `toMessage` and publish it. */
  send: (input: unknown) => void;
}

/** The value returned by {@link useInteraction}. */
export interface UseInteractionResult<
  S,
  Sel extends InteractionSelectors<S> = InteractionSelectors<S>,
> extends InteractionActions {
  /** The interaction's current reduced state (seeded from `initialState`). */
  state: S | undefined;
  /** Selector outputs computed against the current state (empty when none). */
  selectors: SelectorResults<S, Sel>;
}

/** A trailing-edge throttle over the publish of a single interaction's sends. */
interface OutboundThrottle {
  publish: (message: ReturnType<Interaction["toMessage"]>) => void;
  dispose: () => void;
}

function createOutboundThrottle(
  interval: number | undefined,
  publish: (message: ReturnType<Interaction["toMessage"]>) => void,
): OutboundThrottle {
  if (interval === undefined) {
    return { publish, dispose: () => undefined };
  }
  let pending: ReturnType<Interaction["toMessage"]> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    timer = undefined;
    if (pending === undefined) return;
    const message = pending;
    pending = undefined;
    publish(message);
  };
  return {
    publish: (message) => {
      pending = message; // last-in-window wins
      timer ??= setTimeout(flush, interval);
    },
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}

/**
 * Read `interaction`'s state slice, bound sender, and selectors from the active
 * session.
 *
 * @throws when the interaction is not registered, or when used outside a
 *   `<ColabProvider>`.
 */
export function useInteraction<
  S,
  Sel extends InteractionSelectors<S> = InteractionSelectors<S>,
>(
  interaction: InteractionLifecycle<S, Sel>,
): UseInteractionResult<S, Sel> {
  const { session, identity } = useColabContextValue("useInteraction");

  // Registry lookup — a clear, interaction-named error beats an undefined read.
  const registered = session.registry.get(interaction.type);
  if (registered === undefined) {
    throw new Error(
      `useInteraction: interaction "${interaction.type}" is not registered ` +
        `on this <ColabProvider>. Pass it via the provider's \`interactions\` prop.`,
    );
  }

  const key = interactionKey(interaction.type);
  const selector = useCallback(
    (raw: unknown): S | undefined => raw as S | undefined,
    [],
  );
  const raw = useColabStore(key, selector);
  // Contract (1): a descriptor `initialState` makes state concrete pre-fold.
  const state = raw ?? interaction.initialState;

  // Contract (3): trailing-edge outbound coalescing, ≤1 per `throttle` ms.
  // The throttle is bound once per (session, interaction) so timers persist
  // across renders; a new session/descriptor rebuilds and disposes the old one.
  const throttleRef = useRef<OutboundThrottle | null>(null);
  const throttle = useMemo<OutboundThrottle>(
    () =>
      createOutboundThrottle(interaction.throttle, (message) => {
        session.bus.publish(message);
      }),
    [session, interaction],
  );
  throttleRef.current = throttle;
  useEffect(
    () => (): void => {
      throttle.dispose();
    },
    [throttle],
  );

  const localId = identity.id;
  const send = useCallback(
    (input: unknown): void => {
      // Stamp the local sender id: the pure `toMessage` cannot know it, and the
      // session relays / keys inbound folds on `from === localId`.
      const message: ColabMessage = interaction.toMessage(input);
      const stamped: ColabMessage = { ...message, from: localId };
      throttleRef.current?.publish(stamped);
    },
    [interaction, localId],
  );

  // Contract (4): surface selectors computed against the current state.
  const selectors = useMemo<SelectorResults<S, Sel>>(() => {
    const declared = interaction.selectors;
    const out = {} as SelectorResults<S, Sel>;
    if (declared === undefined) return out;
    const current = state as S;
    for (const name of Object.keys(declared) as (keyof Sel)[]) {
      const fn = declared[name];
      if (fn === undefined) continue;
      out[name] = fn(current) as ReturnType<Sel[typeof name]>;
    }
    return out;
  }, [interaction, state]);

  return useMemo<UseInteractionResult<S, Sel>>(
    () => ({ state, send, selectors }),
    [state, send, selectors],
  );
}
