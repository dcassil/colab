/**
 * colab-ui core seam contracts.
 *
 * The authoritative boundary that keeps the core framework- and
 * backend-agnostic. The core imports only these interfaces; concrete
 * implementations are supplied by downstream initiatives (transport & store by
 * I3, interactions by I5) and must not redefine these shapes.
 */
export type { ColabTransport } from "./transport.js";
export type { ColabStore } from "./store.js";
export type { Interaction } from "./interaction.js";
