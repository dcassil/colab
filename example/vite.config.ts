import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { APP_PORT } from "./src/shared/ports.mjs";

/**
 * Vite config for the colab example SPA. Plain React + TS, flat DOM, no iframe.
 * The dev-server port is pinned from the shared single-source-of-truth module so
 * it can never drift from the URL the startup script prints and the e2e opens.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: APP_PORT, strictPort: true },
  preview: { port: APP_PORT, strictPort: true },
});
