/**
 * Single source of truth for the demo's network ports.
 *
 * Both the app's `serverUrl` (consumed by {@link file://../src/colab-config.ts})
 * and the one-command startup script (which starts `colab-server` and Vite)
 * read from here, so the relay bind port and the client's `serverUrl` can never
 * drift. Kept as plain `.mjs` so Node scripts and Vite's config can both import
 * it without a build step.
 */

/** Port the bundled default `colab-server` relay listens on. */
export const COLAB_SERVER_PORT = 3001;

/** Port the example Vite dev server serves the app on. */
export const APP_PORT = 5173;

/** The relay URL the example's `<ColabProvider serverUrl>` connects to. */
export const COLAB_SERVER_URL = `http://localhost:${String(COLAB_SERVER_PORT)}`;

/** The app URL printed by the startup script and opened in two tabs. */
export const APP_URL = `http://localhost:${String(APP_PORT)}`;
