/**
 * `<ColabProvider>` — assembles, drives, and publishes the I2 {@link Session}.
 *
 * Three responsibilities, nothing more (the binding carries no domain logic):
 *  1. ASSEMBLY — turn props into a session via T1's `resolveSessionConfig`
 *     (seams defaulted from I3) and the I2 `createSession` factory, memoized on
 *     the identity-defining inputs so a plain re-render never rebuilds it.
 *     Construction is pure: no `connect()`, no network, during render.
 *  2. LIFECYCLE — an effect keyed on `[session]` starts the session on mount
 *     (connect → join) and stops it on unmount via a paired, idempotent
 *     cleanup, so React Strict Mode's double-invoked effects never leak a
 *     connection and a dependency change tears down the old session before the
 *     new one connects.
 *  3. CONTEXT — publish a referentially stable `{ session }` value that changes
 *     only when the session does.
 */
import { useEffect, useMemo } from "react";

import { createSession } from "../core/session.js";
import { ColabContext } from "./context.js";
import { resolveSessionConfig } from "./resolveSessionConfig.js";
import { startSession } from "./sessionLifecycle.js";
import type { ColabContextValue, ColabProviderProps } from "./types.js";

/** The provider component. See the module doc for the lifecycle contract. */
export function ColabProvider(props: ColabProviderProps): React.ReactElement {
  const {
    serverUrl,
    room,
    identity,
    transport,
    store,
    interactions,
    getToken,
    children,
  } = props;

  // ASSEMBLY — pure construction, memoized on the identity-defining inputs.
  const session = useMemo(() => {
    const config = resolveSessionConfig({
      serverUrl,
      room,
      identity,
      ...(transport !== undefined ? { transport } : {}),
      ...(store !== undefined ? { store } : {}),
      ...(interactions !== undefined ? { interactions } : {}),
      ...(getToken !== undefined ? { getToken } : {}),
    });
    const created = createSession(config.deps);
    for (const interaction of config.interactions) {
      created.registry.register(interaction);
    }
    return created;
  }, [serverUrl, room, identity, transport, store, interactions, getToken]);

  // LIFECYCLE — effect-driven, paired, Strict-Mode-safe.
  useEffect(
    () => startSession({ session, room, identity, ...(getToken !== undefined ? { getToken } : {}) }),
    [session, room, identity, getToken],
  );

  // CONTEXT — stable value; changes only when the session changes.
  const value = useMemo<ColabContextValue>(() => ({ session }), [session]);

  return <ColabContext.Provider value={value}>{children}</ColabContext.Provider>;
}
