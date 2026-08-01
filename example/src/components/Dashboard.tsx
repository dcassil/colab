/**
 * The demo dashboard — a plain flat panel that becomes multiplayer.
 *
 * The dashboard panel is a `<ColabStage>`: it is the cursor ANCHOR. colab
 * samples the local pointer as anchor-relative normalized 0–1 points and
 * positions remote cursors with `<RemoteCursors>` using the default identity
 * transform, so there is ZERO geometry math in this app. `useCursorCapture`
 * publishes the local pointer; `<RemoteCursors>` renders everyone else's.
 */
import type { CSSProperties, ReactElement } from "react";

import { ColabStage, RemoteCursors, useCursorCapture } from "colab-ui/react";
import type { Identity } from "colab-ui/react";

import { LockableField } from "./LockableField.js";
import { Roster } from "./Roster.js";

const STAGE_STYLE: CSSProperties = {
  position: "relative",
  minHeight: 360,
  border: "1px solid #d4d4d8",
  borderRadius: 12,
  background: "#fafafa",
  padding: 24,
  overflow: "hidden",
};

const PAGE_STYLE: CSSProperties = {
  maxWidth: 720,
  margin: "40px auto",
  padding: "0 16px",
  fontFamily: "system-ui, sans-serif",
  color: "#18181b",
};

/** Hooks that require the enclosing `<ColabStage>` context live here. */
function StageContent({ identity }: { identity: Identity }): ReactElement {
  // Publish this tab's normalized pointer to the room (throttled by colab).
  useCursorCapture();

  return (
    <>
      <p style={{ marginTop: 0, color: "#52525b" }}>
        Move your pointer, focus the field, and open a second tab — you are{" "}
        <strong style={{ color: identity.color }}>{identity.name}</strong>.
      </p>
      <LockableField identity={identity} />
      {/* The ONLY screen-space math in the whole app lives inside colab's
          <RemoteCursors>; this app passes no transform (identity default). */}
      <RemoteCursors />
    </>
  );
}

export function Dashboard({
  identity,
}: {
  identity: Identity;
}): ReactElement {
  return (
    <main style={PAGE_STYLE}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>colab example</h1>
        <Roster />
      </header>
      <ColabStage style={STAGE_STYLE} data-testid="stage">
        <StageContent identity={identity} />
      </ColabStage>
    </main>
  );
}
