/**
 * colab-ui default store adapters (I3 seam defaults).
 *
 * Concrete, framework-free implementations of the I2 {@link ColabStore} seam.
 * The default {@link createInMemoryStore} ships here; alternative adapters over
 * external managers (Zustand / Redux / Jotai / valtio) plug in behind the same
 * interface without the core ever knowing which backs it.
 */
export { createInMemoryStore } from "./inMemoryStore.js";
