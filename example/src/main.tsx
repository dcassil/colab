/**
 * App entry. Mounts the flat React SPA — no iframe, no host, no CMS. The whole
 * multiplayer surface is assembled inside {@link App} via `<ColabProvider>`.
 *
 * NOTE — React.StrictMode is intentionally NOT used here (upstream bug, filed to
 * I3/I6). Under StrictMode's dev-only double-invoked effects (mount → cleanup →
 * mount), `<ColabProvider>`'s lifecycle disconnects and never restores the
 * OUTBOUND relay: after the remount the session's `localId` stays cleared and
 * `relayIfLocal` drops every local cursor/interaction, so peers see the roster
 * but no cursors/locks/pings. Dropping StrictMode restores the happy path;
 * remove this note once the provider is genuinely StrictMode-safe on the relay.
 */
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("example: #root container missing from index.html");
}

createRoot(container).render(<App />);
