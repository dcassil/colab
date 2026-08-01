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

import { identity as identityTransform } from "../coordinate/types.js";
import { createSession } from "../core/session.js";
import { ColabContext } from "./context.js";
import { resolveSessionConfig } from "./resolveSessionConfig.js";
import { startSession } from "./sessionLifecycle.js";
import type { ColabContextValue, ColabProviderProps } from "./types.js";

type SessionContextValue = Pick<ColabContextValue, "session" | "store">;

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
    transform,
    children,
  } = props;

  // ASSEMBLY — pure construction, memoized on the identity-defining inputs. The
  // session and the store it writes through are captured together so the
  // context value below stays a single stable reference per session.
  const sessionValue = useMemo<SessionContextValue>(() => {
    const config = resolveSessionConfig({
      serverUrl,
      room,
      identity,
      ...(transport !== undefined ? { transport } : {}),
      ...(store !== undefined ? { store } : {}),
      ...(interactions !== undefined ? { interactions } : {}),
      ...(getToken !== undefined ? { getToken } : {}),
    });
    const session = createSession(config.deps);
    for (const interaction of config.interactions) {
      session.registry.register(interaction);
    }
    return { session, store: config.deps.store };
  }, [serverUrl, room, identity, transport, store, interactions, getToken]);

  const value = useMemo<ColabContextValue>(
    () => ({
      ...sessionValue,
      transform: transform ?? identityTransform,
      identity,
    }),
    [sessionValue, transform, identity],
  );

  const session = sessionValue.session;
  const resolvedStore = sessionValue.store;

  // LIFECYCLE — effect-driven, paired, Strict-Mode-safe.
  useEffect(
    () =>
      startSession({
        session,
        store: resolvedStore,
        room,
        identity,
        ...(getToken !== undefined ? { getToken } : {}),
      }),
    [session, resolvedStore, room, identity, getToken],
  );

  return <ColabContext.Provider value={value}>{children}</ColabContext.Provider>;
}
