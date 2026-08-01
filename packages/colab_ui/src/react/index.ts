/**
 * colab-ui React binding — public entry (`colab-ui/react`).
 *
 * The idiomatic React surface over the framework-free core: `<ColabProvider>`
 * plus the three `use*` hooks and their public types. Everything is exported by
 * EXPLICIT NAME (never a wildcard) so the public API is exactly this set and no
 * more. Internal modules — `ColabContext`, `useColabStore`, `useColabContext`,
 * `resolveSessionConfig`, `sessionLifecycle`, the mirrors, and `storeKeys` — are
 * deliberately NOT re-exported here, so no core/seam internal leaks through this
 * entry (REQ-009).
 *
 * The consumer-facing I2/I3 types a caller must NAME at the boundary
 * (`Identity`/`Participant` for props and roster reads; `ColabTransport` /
 * `ColabStore` / `Interaction` for seam overrides; `Session` as `useColab`'s
 * return) are re-exported through this package's own public modules — never a
 * deep internal path. `react` / `react-dom` are PEER dependencies imported as
 * peers and never bundled. This module is side-effect-free for tree-shaking.
 */

// ── Provider + hooks (values) ────────────────────────────────────────────────
export { ColabProvider } from "./ColabProvider.js";
export { useColab } from "./useColab.js";
export { usePresence } from "./usePresence.js";
export { useInteraction } from "./useInteraction.js";
export { AvatarStack } from "../ui/avatar-stack/index.js";
export {
  ColabStage,
  ColabStageContext,
  identity,
  useColabStage,
} from "../coordinate/index.js";

// ── I5 reference interaction + generic cursor UI (additive) ───────────────────
export { Cursor } from "../interactions/cursor/index.js";
export { RemoteCursors, useCursorCapture } from "../ui/remote-cursors/index.js";

// ── Public error a consumer may catch ────────────────────────────────────────
export { ColabProviderMissingError } from "./useColabContext.js";

// ── Binding-owned public types ───────────────────────────────────────────────
export type { ColabProviderProps, GetToken } from "./types.js";
export type {
  InteractionActions,
  UseInteractionResult,
} from "./useInteraction.js";
export type { AvatarStackProps } from "../ui/avatar-stack/index.js";
export type {
  ColabStageContextValue,
  Point,
  PointerSampleListener,
  PointerSampleSource,
  StageBox,
  Transform,
} from "../coordinate/index.js";
export type {
  CursorPoint,
  CursorState,
  RemoteCursorEntry,
} from "../interactions/cursor/index.js";
export type {
  RemoteCursorsProps,
  RemoteCursorRenderArgs,
} from "../ui/remote-cursors/index.js";

// ── Consumed I2/I3 types a React consumer must name at the boundary ──────────
export type { Identity, Participant } from "colab-protocol";
export type { Session } from "../core/session.js";
export type { ColabTransport } from "../contracts/transport.js";
export type { ColabStore } from "../contracts/store.js";
export type { Interaction } from "../contracts/interaction.js";
