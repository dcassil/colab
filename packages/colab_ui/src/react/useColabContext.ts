/**
 * `useColabContextValue` — the internal context accessor shared by every hook.
 *
 * Reads {@link ColabContext} and throws a single, descriptive
 * {@link ColabProviderMissingError} when no `<ColabProvider>` is above the
 * caller. Centralizing the read means `useColab`, `usePresence`, and
 * `useInteraction` all surface the exact same misuse error. This module is
 * INTERNAL — it is not re-exported from the React public entry.
 */
import { useContext } from "react";

import { ColabContext } from "./context.js";
import type { ColabContextValue } from "./types.js";

/** Thrown when a colab hook is used outside a `<ColabProvider>`. */
export class ColabProviderMissingError extends Error {
  constructor(hookName: string) {
    super(
      `${hookName} must be used within a <ColabProvider>. Wrap the subtree ` +
        `that calls this hook in a <ColabProvider serverUrl room identity>.`,
    );
    this.name = "ColabProviderMissingError";
  }
}

/**
 * Return the current {@link ColabContextValue}, or throw
 * {@link ColabProviderMissingError} (named after `hookName`) when there is no
 * provider above the caller.
 */
export function useColabContextValue(hookName: string): ColabContextValue {
  const value = useContext(ColabContext);
  if (value === null) throw new ColabProviderMissingError(hookName);
  return value;
}
