/**
 * colab-ui core primitives (framework-free).
 *
 * The engine the seams plug into: the typed message bus, and (in later I2
 * tasks) the roster, interaction registry, and session lifecycle.
 */
export { createMessageBus } from "./bus.js";
export type { MessageBus, MessageHandler, BusErrorReporter } from "./bus.js";

export { createRoster } from "./roster.js";
export type { Roster } from "./roster.js";

export { createInteractionRegistry } from "./registry.js";
export type { InteractionRegistry } from "./registry.js";
