/**
 * Public prop/type surface for the I4 React binding.
 *
 * These types describe how a React consumer configures `<ColabProvider>` and
 * what the hooks hand back. They CONSUME the I2 core contracts and I3 default
 * seams (imported from this package's own public modules) and add no domain
 * vocabulary of their own — the binding is a thin adapter.
 */
import type { ReactNode } from "react";

import type { Identity } from "colab-protocol";

import type { Interaction } from "../contracts/interaction.js";
import type { ColabStore } from "../contracts/store.js";
import type { ColabTransport } from "../contracts/transport.js";
import type { Session } from "../core/session.js";

/** How the identity path obtains a (possibly refreshed) auth token. */
export type GetToken = () => string | Promise<string>;

/**
 * Props accepted by `<ColabProvider>`.
 *
 * The three required props (`serverUrl` / `room` / `identity`) are the one-line
 * happy path; every seam is optional and falls back to an I3 default. Overrides
 * are the exact I2 seam interfaces, so a consumer can swap a transport or store
 * without forking.
 */
export interface ColabProviderProps {
  /** Relay URL the default Socket.IO transport connects to. */
  serverUrl: string;
  /** Room to join after connecting. */
  room: string;
  /** The local participant's self-asserted identity. */
  identity: Identity;
  /** Override the default Socket.IO transport with any {@link ColabTransport}. */
  transport?: ColabTransport;
  /** Override the default in-memory {@link ColabStore}. */
  store?: ColabStore;
  /** Interactions to register on the session before it connects. */
  interactions?: readonly Interaction[];
  /** Async/sync token-getter threaded into the default transport's handshake. */
  getToken?: GetToken;
  /** The subtree that reads the session via the hooks. */
  children?: ReactNode;
}

/** The value carried on {@link ColabContext}: only the live session handle. */
export interface ColabContextValue {
  /** The I2 session assembled and owned by `<ColabProvider>`. */
  session: Session;
}
