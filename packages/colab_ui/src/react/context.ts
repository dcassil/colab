/**
 * `ColabContext` — the React context carrying the live I2 {@link Session}.
 *
 * It carries the SESSION, never the raw store: hooks derive the store, roster,
 * and interaction registry from the one authoritative session handle so the
 * context surface stays minimal and stable. The default is `null` so a hook
 * called outside `<ColabProvider>` can detect the missing provider and throw a
 * descriptive error (see {@link useColab}).
 *
 * No domain logic lives here — this module only defines the context object.
 */
import { createContext } from "react";

import type { ColabContextValue } from "./types.js";

/**
 * The context value is `{ session } | null`. `null` marks "no provider above
 * me", which every hook translates into a clear developer error.
 */
export const ColabContext = createContext<ColabContextValue | null>(null);

ColabContext.displayName = "ColabContext";
