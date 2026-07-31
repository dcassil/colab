/**
 * colab_server — public entry (skeleton).
 *
 * Generic, interaction-agnostic relay lands in initiative I6.
 * May import `@colab/protocol`; must never import `colab_ui`.
 */
import { PROTOCOL_PACKAGE } from "@colab/protocol";

/** Package name marker, replaced by real relay exports downstream. */
export const COLAB_SERVER_PACKAGE = "colab_server" as const;

/** Proves the protocol project reference resolves at build time. */
export const PROTOCOL_LINK = PROTOCOL_PACKAGE;
