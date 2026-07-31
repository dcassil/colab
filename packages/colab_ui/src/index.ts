/**
 * colab-ui — framework-agnostic collaboration core (public entry).
 *
 * Exposes the seam CONTRACTS the core depends on ({@link ColabTransport},
 * {@link ColabStore}, {@link Interaction}). Concrete implementations of these
 * seams are supplied by downstream initiatives (I3 transport/store, I5
 * interactions), never by this package. Core primitives (MessageBus, Roster,
 * InteractionRegistry, Session) are added by later I2 tasks.
 *
 * May import `colab-protocol`; must never import `colab-server`.
 */
export type {
  ColabTransport,
  ColabStore,
  Interaction,
} from "./contracts/index.js";

export { createMessageBus } from "./core/index.js";
export type {
  MessageBus,
  MessageHandler,
  BusErrorReporter,
} from "./core/index.js";
