/**
 * colab-ui Identity/Auth client path (I3 seam default).
 *
 * The client half of the Identity/Auth seam: obtain + normalize identity and
 * (optional) token, and thread them into a transport's `connect` handshake.
 * The server-side `verify` slot is I6's, not exported here.
 */
export {
  resolveIdentity,
  createIdentityProvider,
  InvalidIdentityError,
} from "./identityProvider.js";
export type {
  ColabCredentials,
  IdentityInput,
  IdentityProvider,
} from "./identityProvider.js";
