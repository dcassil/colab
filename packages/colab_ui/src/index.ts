/**
 * @colab/ui — public entry (skeleton).
 *
 * Framework-agnostic core + React binding land in initiatives I2–I5.
 * May import `@colab/protocol`; must never import `@colab/server`.
 */
import { PROTOCOL_PACKAGE } from "@colab/protocol";

/** Package name marker, replaced by real UI/core exports downstream. */
export const COLAB_UI_PACKAGE = "@colab/ui" as const;

/** Proves the protocol project reference resolves at build time. */
export const PROTOCOL_LINK = PROTOCOL_PACKAGE;
