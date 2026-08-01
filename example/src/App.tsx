/**
 * The example app root — the one-line multiplayer story in one component.
 *
 * `<ColabProvider>` is wired with ONLY the three required props (`serverUrl`,
 * `room`, `identity`) plus the `interactions` array. No custom `transport` or
 * `store` is passed, so colab uses its DEFAULT Socket.IO transport and DEFAULT
 * in-memory store. No `transform` is passed either, so the coordinate seam stays
 * at colab's identity default — the geometry-free proof: cursors are positioned
 * from anchor-relative normalized 0–1 points with zero geometry math here.
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

/** All interactions registered on the session, in one place. */
const INTERACTIONS: readonly Interaction[] = [Cursor, EditLock];

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
