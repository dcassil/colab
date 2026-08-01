/**
 * App entry. Mounts the flat React SPA — no iframe, no host, no CMS. The whole
 * multiplayer surface is assembled inside {@link App} via `<ColabProvider>`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("example: #root container missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
