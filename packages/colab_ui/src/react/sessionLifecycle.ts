/**
 * `startSession` — the paired, idempotent connect/join → disconnect lifecycle.
 *
 * The I2 {@link Session} splits opening the transport (`connect`) from
 * announcing the local participant (`joinRoom`). This helper composes both into
 * a single "start" and returns a "stop" that fully tears the session down. It
 * is deliberately guarded so React 18/19 Strict Mode's double-invoked effects
 * (mount → cleanup → mount) never leak a connection or double-announce:
 *
 *   - A local `stopped` flag makes `stop()` idempotent and makes an async token
 *     resolution that finishes AFTER `stop()` a no-op (no join on a torn-down
 *     session, no orphaned connection).
 *   - `connect()` and `joinRoom()` run only while not stopped.
 *
 * Token resolution (`getToken`) is async, so the start is async; `stop()` is
 * synchronous and safe to call before start settles.
 */
import type { Identity } from "colab-protocol";

import type { Session } from "../core/session.js";
import type { GetToken } from "./types.js";

/** Inputs describing how to start one session lifecycle. */
export interface StartSessionInput {
  session: Session;
  room: string;
  identity: Identity;
  getToken?: GetToken;
}

/**
 * Connect the session, resolve an optional token, then announce the join.
 * Returns a synchronous, idempotent `stop` closure for the effect cleanup.
 */
export function startSession(input: StartSessionInput): () => void {
  const { session, room, identity, getToken } = input;
  // Boxed in an object so `stop()` mutating it is visible to the async join
  // closure (a plain `let` would be narrowed to its initializer by control-flow
  // analysis, since the reassignment happens in a different function scope).
  const state = { stopped: false };

  function stop(): void {
    if (state.stopped) return;
    state.stopped = true;
    void session.disconnect();
  }

  // Connect synchronously so the transport is opened + subscribed within the
  // commit (and its call counts are observable immediately). Only the optional
  // token resolution is async; the join waits on it but is skipped if `stop()`
  // ran first.
  void session.connect();

  if (getToken === undefined) {
    void session.joinRoom(room, identity);
  } else {
    void (async (): Promise<void> => {
      const token = await getToken();
      if (state.stopped) return;
      void session.joinRoom(room, identity, token);
    })();
  }

  return stop;
}
