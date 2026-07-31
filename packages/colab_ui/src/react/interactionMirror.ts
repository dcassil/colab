/**
 * `mirrorInteractions` — fold interaction messages into per-interaction store
 * slices so `useInteraction` can read them through the shared store primitive.
 *
 * The I2 `Interaction<S>` descriptor supplies `reduce(state, message)` but I2
 * keeps no reduced interaction STATE anywhere (the registry holds only the
 * descriptors, the bus only routes). The binding therefore drives the fold: for
 * each registered interaction it subscribes to both the local (`interaction`)
 * and inbound-peer (`server_interaction`) message streams on the session bus,
 * applies the descriptor's own `reduce` to messages whose payload `name`
 * matches the interaction `type`, and writes the result to the store under
 * {@link interactionKey}. This adds no interaction BEHAVIOR — it only projects
 * the descriptor's own reducer output onto the store seam the binding owns.
 *
 * Each slice seeds at `undefined`; the descriptor's `reduce` builds the state
 * from there (I2's `Interaction` declares no separate initial-state field).
 */
import { COLAB_EVENTS, COLAB_SERVER_EVENTS } from "colab-protocol";
import type { ColabMessage } from "colab-protocol";

import type { Interaction } from "../contracts/interaction.js";
import type { ColabStore } from "../contracts/store.js";
import type { Session } from "../core/session.js";
import { interactionKey } from "./storeKeys.js";

/** Does this interaction message target `interaction`? Matches on payload name. */
function targets(interaction: Interaction, message: ColabMessage): boolean {
  const payload = message.payload as { name?: unknown } | undefined;
  return payload?.name === interaction.type;
}

/**
 * Read an OPTIONAL `initialState` off a registered interaction. The neutral I2
 * `Interaction` seam declares none, but the T1 `defineInteraction` descriptor
 * carries one; seeding from it satisfies the lifecycle contract's "fresh state
 * per instance" so a descriptor's `reduce` never sees an unseeded `undefined`.
 */
function initialStateOf(interaction: Interaction): unknown {
  const seed = (interaction as { initialState?: unknown }).initialState;
  return seed;
}

/** Wire one interaction's fold; returns an unsubscribe closure. */
function mirrorOne(
  session: Session,
  store: ColabStore,
  interaction: Interaction,
): () => void {
  const key = interactionKey(interaction.type);

  // Contract (1): seed a fresh slice from the descriptor's `initialState` so
  // `reduce` folds onto a concrete seed and read hooks see it before any fold.
  const seed = initialStateOf(interaction);
  if (seed !== undefined && store.get(key) === undefined) {
    store.set(key, seed);
  }

  const fold = (message: ColabMessage): void => {
    if (!targets(interaction, message)) return;
    const prev = store.get(key);
    store.set(key, interaction.reduce(prev, message));
  };

  const unsubLocal = session.bus.subscribe(COLAB_EVENTS.INTERACTION, fold);
  const unsubPeer = session.bus.subscribe(COLAB_SERVER_EVENTS.INTERACTION, fold);
  return () => {
    unsubLocal();
    unsubPeer();
  };
}

/**
 * Wire folds for every interaction registered on the session. Returns a single
 * unsubscribe closure that detaches them all.
 */
export function mirrorInteractions(
  session: Session,
  store: ColabStore,
): () => void {
  const unsubs = session.registry
    .list()
    .map((interaction) => mirrorOne(session, store, interaction));
  return () => {
    for (const unsub of unsubs) unsub();
  };
}
