/**
 * The example app root — the one-line multiplayer story in one component.
 *
 * `<ColabProvider>` is wired with the three required props (`serverUrl`, `room`,
 * `identity`) plus the `interactions` array, and the DEFAULT in-memory store
 * (no `store` prop). No `transform` is passed either, so the coordinate seam
 * stays at colab's identity default — the geometry-free proof: cursors are
 * positioned from anchor-relative normalized 0–1 points with zero geometry
 * math here.
 *
 * The one deviation from "defaults only" is the `transport` prop: it is a THIN
 * shim over the default Socket.IO transport that only works around current
 * upstream defects (connect/join ordering, missing handshake `roomId`, and the
 * default transport's wire shape not matching the default server). See
 * `./colab-transport` for the full write-up. It is NOT a different backend and
 * should be deleted once the shipped defaults interoperate.
 *
 * A custom interaction is registered alongside the reference `Cursor` +
 * `EditLock` interactions purely by listing it in this array — no colab core
 * edit, the sole extension point (added in PROJ-T-0048).
 */
import { useMemo } from "react";
import type { ReactElement } from "react";

import { EditLock } from "colab-ui";
import { ColabProvider, Cursor } from "colab-ui/react";
import type { ColabTransport, Identity, Interaction } from "colab-ui/react";

import { Dashboard } from "./components/Dashboard.js";
import { createDemoIdentity, ROOM, SERVER_URL } from "./colab-config.js";
import { createBufferedSocketTransport } from "./colab-transport.js";
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

  // The DEFAULT Socket.IO transport, wrapped with a pre-connect send buffer to
  // work around an upstream connect/join ordering bug (see ./colab-transport).
  // Memoized on identity so a plain re-render never rebuilds the connection.
  const transport: ColabTransport = useMemo(
    () =>
      createBufferedSocketTransport({
        url: SERVER_URL,
        room: ROOM,
        identity,
      }),
    [identity],
  );

  return (
    <ColabProvider
      serverUrl={SERVER_URL}
      room={ROOM}
      identity={identity}
      transport={transport}
      interactions={INTERACTIONS}
    >
      <Dashboard identity={identity} />
    </ColabProvider>
  );
}
