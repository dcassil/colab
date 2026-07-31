/**
 * Identity/Auth CLIENT path — `resolveIdentity` / `createIdentityProvider`.
 *
 * The client half of the Identity/Auth seam: it isolates HOW credentials are
 * obtained (a static token, an async token-getter, or nothing) from HOW they
 * are sent (the transport's handshake `auth`, e.g. T3's socket.io `auth`). It
 * accepts consumer-supplied `{ identity, token?, getToken? }`, validates and
 * normalizes the {@link Identity} against the I2 shape, resolves the token, and
 * yields exactly the {@link ColabCredentials} object a transport's `connect`
 * places on the wire.
 *
 * SCOPE FENCE: I3 owns ONLY the client half — providing identity/token and
 * threading it into `connect`. The server-side `verify(token, identity)` slot
 * is explicitly I6's responsibility and out of scope here; this utility only
 * guarantees the credentials arrive on the wire, never that they are accepted.
 *
 * The utility is transport-agnostic: it imports no transport. T2/T3 consume its
 * output. `ColabCredentials` is the SINGLE shared credential shape, defined
 * against I2's `Identity`; the socket transport's handshake `auth` is
 * structurally this shape.
 */
import type { Identity } from "colab-protocol";

/**
 * The resolved credential object handed to a transport's `connect` and placed
 * in its handshake `auth`. `token` is absent on the loopback (no-auth) path.
 */
export interface ColabCredentials {
  /** The normalized, validated self-asserted identity. */
  identity: Identity;
  /** The resolved credential, when one was supplied. */
  token?: string;
}

/** Consumer input describing how to obtain identity + (optional) token. */
export interface IdentityInput {
  /** The self-asserted identity (validated against the I2 `Identity` shape). */
  identity: Identity;
  /** A static token. Ignored if `getToken` is also supplied (getToken wins). */
  token?: string;
  /**
   * An async (or sync) token-getter. When supplied it takes PRECEDENCE over a
   * static `token`, so a fresh token can be fetched per connect.
   */
  getToken?: () => string | Promise<string>;
}

/** Thrown when the supplied identity fails the I2 `Identity` shape. */
export class InvalidIdentityError extends Error {
  constructor(reason: string) {
    super(`resolveIdentity: invalid identity — ${reason}`);
    this.name = "InvalidIdentityError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Validate and normalize an unknown value against the I2 {@link Identity}
 * shape: `id`, `name`, and `color` must be non-empty strings; `extra` (if
 * present) must be an object. Returns a fresh, normalized `Identity`.
 */
function normalizeIdentity(input: unknown): Identity {
  if (input === null || typeof input !== "object") {
    throw new InvalidIdentityError("expected an object");
  }
  const candidate = input as Record<string, unknown>;
  if (!isNonEmptyString(candidate.id)) {
    throw new InvalidIdentityError("`id` must be a non-empty string");
  }
  if (!isNonEmptyString(candidate.name)) {
    throw new InvalidIdentityError("`name` must be a non-empty string");
  }
  if (!isNonEmptyString(candidate.color)) {
    throw new InvalidIdentityError("`color` must be a non-empty string");
  }
  const normalized: Identity = {
    id: candidate.id,
    name: candidate.name,
    color: candidate.color,
  };
  if (candidate.extra !== undefined) {
    if (typeof candidate.extra !== "object" || candidate.extra === null) {
      throw new InvalidIdentityError("`extra` must be an object when present");
    }
    normalized.extra = candidate.extra as NonNullable<Identity["extra"]>;
  }
  return normalized;
}

/**
 * Resolve consumer-supplied identity/auth input into the {@link ColabCredentials}
 * a transport's `connect` expects.
 *
 * Precedence: `getToken` (awaited) takes priority over a static `token`. With
 * neither, the loopback path yields token-free credentials.
 */
export async function resolveIdentity(
  input: IdentityInput,
): Promise<ColabCredentials> {
  const identity = normalizeIdentity(input.identity);
  const token = input.getToken !== undefined
    ? await input.getToken()
    : input.token;
  const credentials: ColabCredentials = { identity };
  if (token !== undefined) credentials.token = token;
  return credentials;
}

/** A reusable identity provider bound to one input; re-resolves per call. */
export interface IdentityProvider {
  /** Resolve fresh credentials (re-invoking `getToken` if configured). */
  resolve(): Promise<ColabCredentials>;
}

/**
 * Build a reusable {@link IdentityProvider} over a fixed input. Each `resolve()`
 * re-runs token resolution, so a configured `getToken` yields a fresh token on
 * every (re)connect while the identity stays validated/normalized once.
 */
export function createIdentityProvider(input: IdentityInput): IdentityProvider {
  const identity = normalizeIdentity(input.identity);
  return {
    resolve: () => resolveIdentity({ ...input, identity }),
  };
}
