/**
 * The example app root — the one-line multiplayer story in one component.
 *
 * `<ColabProvider>` is wired with nothing but the three required props
 * (`serverUrl`, `room`, `identity`) plus the `interactions` array. It uses the
 * DEFAULT everything: the default Socket.IO transport (constructed by the
 * provider from `serverUrl`/`room`/`identity` — no `transport` prop), the
 * DEFAULT in-memory store (no `store` prop), and colab's identity coordinate
 * default (no `transform` prop, so cursors are positioned from anchor-relative
 * normalized 0–1 points with zero geometry math here).
 *
 * There is NO app-level workaround: the shipped `createSocketIoTransport` from
 * `colab-ui` speaks the default server's real protocol (handshake auth with
 * roomId/identity, per-type COLAB_EVENTS, subscribes COLAB_SERVER_EVENTS) and
 * buffers pre-connect sends. So the example is a true "defaults only" proof of
 * the core.
 *
 * A custom interaction is registered alongside the reference `Cursor` +
 * `EditLock` interactions purely by listing it in this array — no colab core
 * edit, the sole extension point (added in PROJ-T-0048).
 */
import { useMemo } from "react";
import type { ReactElement } from "react";

import { EditLock } from "colab-ui";
import { ColabProvider, Cursor } from "colab-ui/react";
import type { Identity, Interaction } from "colab-ui/react";

import { Dashboard } from "./components/Dashboard.js";
import { createDemoIdentity, ROOM, SERVER_URL } from "./colab-config.js";
import { reactionPing } from "./interactions/reactionPing.js";

/**
 * All interactions registered on the session, in one place. The custom
 * `reactionPing` sits right beside the reference `Cursor` + `EditLock` — it is
 * registered by nothing more than appearing in this array. No colab core edit.
 */
const INTERACTIONS: readonly Interaction[] = [Cursor, EditLock, reactionPing];

export function App(): ReactElement {
  // Mint the identity once per mount so a re-render never rejoins as a new peer.
  const identity: Identity = useMemo(() => createDemoIdentity(), []);

  return (
    <ColabProvider
      serverUrl={SERVER_URL}
      room={ROOM}
      identity={identity}
      interactions={INTERACTIONS}
    >
      <Dashboard identity={identity} />
    </ColabProvider>
  );
}
