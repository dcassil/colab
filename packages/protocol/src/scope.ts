/**
 * `ScopeId` — an opaque, branded identifier for a collaboration scope.
 *
 * A `ScopeId` names *some* region a participant can point at or interact
 * within. It is an opaque string: the protocol attaches NO host, document,
 * element, selector, layout, or positional meaning to it. Consumers mint scope ids from
 * whatever addressing scheme their domain uses; the protocol only guarantees
 * the value is a non-empty string and carries the `ScopeId` brand for
 * compile-time distinction from bare strings.
 *
 * The brand is a phantom `readonly __brand` property that never exists at
 * runtime — at runtime a `ScopeId` is exactly its underlying string.
 */
export type ScopeId = string & { readonly __brand: "ScopeId" };

/**
 * Assert that `raw` is a usable scope id and return it as a `ScopeId`.
 *
 * @throws {TypeError} if `raw` is not a non-empty string.
 */
export function asScopeId(raw: string): ScopeId {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new TypeError("asScopeId: scope id must be a non-empty string");
  }
  return raw as ScopeId;
}

/**
 * Compose several domain-owned address parts into one opaque `ScopeId`.
 *
 * The encoding is length-prefixed so different part arrays cannot collide
 * accidentally, and it deliberately carries no domain delimiter semantics.
 *
 * @throws {TypeError} if called without parts or with a non-string part.
 */
export function composeScopeId(...parts: string[]): ScopeId {
  if (parts.length === 0) {
    throw new TypeError("composeScopeId: at least one part is required");
  }
  return asScopeId(
    parts
      .map((part) => {
        if (typeof part !== "string") {
          throw new TypeError("composeScopeId: all parts must be strings");
        }
        return `${String(part.length)}:${part}`;
      })
      .join("|"),
  );
}

/**
 * Runtime type guard narrowing `x` to `ScopeId`.
 *
 * Mirrors {@link asScopeId}'s validity rule (non-empty string) without
 * throwing, so it is safe to use on untrusted wire input.
 */
export function isScopeId(x: unknown): x is ScopeId {
  return typeof x === "string" && x.length > 0;
}
