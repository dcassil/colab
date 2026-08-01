/**
 * Demo-local colab configuration: the relay URL, the room, and a per-tab
 * identity. Everything here is the CONSUMER's concern — colab itself asserts no
 * identity vocabulary; the app supplies `{ id, name, color }` and the room name.
 *
 * A fresh random identity is minted per tab load so opening two tabs simulates
 * two participants without any login. The `serverUrl` is read from the shared
 * single-source-of-truth ports module so it always matches the port the bundled
 * `colab-server` binds (no drift with the startup script).
 */
import type { Identity } from "colab-ui/react";

import { COLAB_SERVER_URL } from "./shared/ports.mjs";

/** The relay URL the default Socket.IO transport connects to. */
export const SERVER_URL: string = COLAB_SERVER_URL;

/** The shared room every tab of the demo joins. */
export const ROOM = "demo";

const ADJECTIVES = ["Swift", "Calm", "Bright", "Bold", "Keen", "Warm"] as const;
const ANIMALS = ["Otter", "Falcon", "Fox", "Heron", "Lynx", "Wren"] as const;
const COLORS = [
  "#4f46e5",
  "#0891b2",
  "#db2777",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
] as const;

function pick<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  // `noUncheckedIndexedAccess` — index is always in range, but narrow safely.
  return items[index] ?? items[0] ?? (undefined as never);
}

/**
 * Mint a fresh random identity for this tab. Two tabs → two identities → two
 * participants in the same room, which is the whole two-tab demo.
 */
export function createDemoIdentity(): Identity {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `p-${String(Math.random()).slice(2)}`;
  const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
  return { id, name, color: pick(COLORS) };
}
