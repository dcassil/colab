/**
 * colab-ui React binding — public entry (`colab-ui/react`).
 *
 * The idiomatic React surface over the framework-free core: `<ColabProvider>`
 * plus the `use*` hooks and their public types. It exports ONLY the consumer
 * surface — the context object, the seam-defaulting helper, and other internals
 * stay unexported so no core/seam module leaks through this entry.
 *
 * `react` / `react-dom` are PEER dependencies; this module imports them as
 * peers and never bundles them. The curated export list is finalized in T7; the
 * additions below land as their tasks complete.
 */
export { ColabProvider } from "./ColabProvider.js";

export type {
  ColabProviderProps,
  ColabContextValue,
  GetToken,
} from "./types.js";
