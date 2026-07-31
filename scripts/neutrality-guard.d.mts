// Type declarations for the neutrality guard (NFR-001), so its pure matcher
// can be imported and type-checked by the Vitest negative-case test.

export interface ForbiddenToken {
  token: string;
  why: string;
}

export interface ForbiddenHit {
  token: string;
  line: number;
  column: number;
}

export const FORBIDDEN_TOKENS: readonly ForbiddenToken[];

export const SCANNED_DIRS: readonly string[];

/** Return every forbidden-token hit in `text` with 1-based line/column. */
export function findForbidden(text: string): ForbiddenHit[];
