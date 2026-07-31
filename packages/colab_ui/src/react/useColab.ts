/**
 * `useColab` — the primary hook returning the live I2 {@link Session} handle.
 *
 * The session is the one authoritative handle: its `bus` / `roster` / `registry`
 * are read-only surfaces and its `connect` / `joinRoom` / `disconnect` are the
 * imperative lifecycle. `useColab` hands that handle straight through, so the
 * return value and every method on it are BOUND ONCE per session and thus
 * referentially stable across renders — an unrelated re-render never changes the
 * handle identity. When called outside a `<ColabProvider>` it throws the shared,
 * descriptive {@link ColabProviderMissingError}.
 *
 * CONNECTION STATUS: the I2 `Session` contract intentionally does NOT model a
 * connection-status slice (status is a transport/relay concern owned by I3/I6,
 * not the neutral core). This binding therefore does not fabricate one — doing
 * so would redefine the consumed contract. When I2/I3 later expose status as a
 * store slice, a `status` field can be layered on via {@link useColabStore}
 * without changing this hook's stable-identity guarantee. Presence and
 * interaction state, which ARE observable today, are read through the dedicated
 * `usePresence` / `useInteraction` hooks.
 */
import type { Session } from "../core/session.js";
import { useColabContextValue } from "./useColabContext.js";

/**
 * Return the live {@link Session} handle from the nearest `<ColabProvider>`.
 *
 * @throws {ColabProviderMissingError} when used outside a `<ColabProvider>`.
 */
export function useColab(): Session {
  return useColabContextValue("useColab").session;
}
