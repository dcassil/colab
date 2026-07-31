/**
 * `resolveSessionConfig` — the seam-defaulting helper.
 *
 * Maps `<ColabProvider>` props into the pieces needed to assemble and drive an
 * I2 {@link Session}: the {@link SessionDeps} the session is constructed from
 * (`transport` + `store`, each defaulted from an I3 seam when the prop is
 * omitted) plus the runtime inputs the provider threads into `joinRoom`
 * (`room`, `identity`) and the registry (`interactions`).
 *
 * PURITY: this function performs NO I/O. `createSocketIoTransport` builds a
 * transport whose `socket.io-client` import is lazy and whose `connect()` is
 * never called here; `createInMemoryStore` allocates plain `Map`s. Constructing
 * the config must be safe to run during render and idempotent per inputs.
 *
 * BOUNDARY: it consumes the I2 config type ({@link SessionDeps}) and the I3
 * defaults ({@link createInMemoryStore}, {@link createSocketIoTransport}) only
 * through this package's own public modules — no deep coupling.
 */
import type { Identity } from "colab-protocol";

import type { Interaction } from "../contracts/interaction.js";
import type { SessionDeps } from "../core/session.js";
import { createInMemoryStore } from "../store/index.js";
import { createSocketIoTransport } from "../transport/index.js";
import type { ColabProviderProps } from "./types.js";

/** The fully-resolved inputs the provider needs to build and drive a session. */
export interface ResolvedSessionConfig {
  /** What `createSession` is constructed from (both seams resolved). */
  deps: SessionDeps;
  /** The room the provider announces via `joinRoom`. */
  room: string;
  /** The local identity the provider announces via `joinRoom`. */
  identity: Identity;
  /** Interactions to register on the session before connecting. */
  interactions: readonly Interaction[];
}

/**
 * Resolve provider props into a {@link ResolvedSessionConfig}, defaulting the
 * transport and store seams from I3 when the corresponding prop is omitted.
 */
export function resolveSessionConfig(
  props: ColabProviderProps,
): ResolvedSessionConfig {
  const { serverUrl, room, identity, transport, store, interactions } = props;

  const resolvedTransport =
    transport ??
    createSocketIoTransport({
      url: serverUrl,
      room,
      identity,
    });

  const resolvedStore = store ?? createInMemoryStore();

  return {
    deps: { transport: resolvedTransport, store: resolvedStore },
    room,
    identity,
    interactions: interactions ?? [],
  };
}
