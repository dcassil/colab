/**
 * `useIdentity` — the local participant's own {@link Identity}.
 *
 * The I2 `Session` intentionally does not surface the local identity (the
 * roster carries only REMOTE participants — see `usePresence`), yet UI often
 * needs the local name/color/id: to render "you", to key self out of a list, or
 * to stamp an outbound message's `from`. Earlier I5 work added `identity` to
 * {@link ColabContextValue}; this hook exposes it through the same
 * outside-provider guard every other hook uses, so it is the one blessed read
 * for local identity and never fabricates a value.
 *
 * The returned reference is stable across renders as long as the `identity`
 * prop handed to `<ColabProvider>` is stable.
 */
import type { Identity } from "colab-protocol";

import { useColabContextValue } from "./useColabContext.js";

/**
 * Return the local participant's {@link Identity} from the nearest
 * `<ColabProvider>`.
 *
 * @throws {ColabProviderMissingError} when used outside a `<ColabProvider>`.
 */
export function useIdentity(): Identity {
  return useColabContextValue("useIdentity").identity;
}
