// Neutrality guard (NFR-001) — PROJ-T-0010.
//
// Mechanically enforces that the shared wire contract (`packages/protocol`) and
// the framework-free core engine (`packages/colab_ui/src/core`) contain NO
// CMS / iframe / geometry / host-layout vocabulary. This prevents "neutrality
// leakage" — accidental CMS/iframe naming creeping in from the source
// `presence` code during extraction — from ever regressing.
//
// Runs in CI as `pnpm neutrality` alongside typecheck/lint/test/build/depcruise.
// The pure `findForbidden` matcher is also imported by a Vitest test which
// proves the guard catches a seeded violation (so it can never be a false green).
//
// Design notes:
//  - Each forbidden token is word-bounded to avoid false positives inside
//    legitimate identifiers, and carries a one-line rationale tied to NFR-001.
//  - Test files (`*.test.ts`) are EXCLUDED: the guard's own negative-case test
//    and any comparison tests legitimately mention the forbidden tokens.

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

/**
 * Forbidden tokens (case-insensitive, word-bounded). Each entry documents why
 * it violates NFR-001 neutrality.
 * @type {{ token: string, why: string }[]}
 */
export const FORBIDDEN_TOKENS = [
  { token: "cms", why: "CMS coupling — the contract must be domain-neutral" },
  { token: "data-cms", why: "CMS DOM-attribute vocabulary from the source presence code" },
  { token: "iframe", why: "iframe/host-embedding assumption — transport must be neutral" },
  { token: "geometry", why: "no transform/projection/geometry logic lives in the contract" },
  { token: "host-layout", why: "host-page layout coupling — the core is layout-agnostic" },
];

// Word-bounded, case-insensitive matchers. `data-cms` / `host-layout` are
// matched as explicit hyphenated tokens; the rest use \b word boundaries.
const MATCHERS = FORBIDDEN_TOKENS.map(({ token }) => {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = token.includes("-")
    ? `(?<![\\w-])${escaped}(?![\\w-])`
    : `\\b${escaped}\\b`;
  return { token, re: new RegExp(pattern, "i") };
});

/**
 * Return every forbidden-token hit in `text` as `{ token, line, column }`.
 * Pure and dependency-free so tests can exercise it on synthetic strings.
 * @param {string} text
 * @returns {{ token: string, line: number, column: number }[]}
 */
export function findForbidden(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const { token, re } of MATCHERS) {
      const m = re.exec(lines[i]);
      if (m) hits.push({ token, line: i + 1, column: m.index + 1 });
    }
  }
  return hits;
}

/** Directories scanned by the guard (relative to repo root). */
export const SCANNED_DIRS = [
  "packages/protocol/src",
  "packages/colab_ui/src/core",
];

/** @param {string} dir @returns {Promise<string[]>} absolute `.ts` non-test files */
async function collectSources(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSources(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const violations = [];
  for (const rel of SCANNED_DIRS) {
    const files = await collectSources(join(REPO_ROOT, rel));
    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const hit of findForbidden(text)) {
        violations.push(
          `${relative(REPO_ROOT, file)}:${hit.line}:${hit.column}  forbidden token "${hit.token}"`,
        );
      }
    }
  }

  if (violations.length > 0) {
    console.error("Neutrality guard (NFR-001) FAILED — forbidden tokens found:");
    for (const v of violations) console.error(`  ${v}`);
    console.error(
      "\nThe protocol and core must contain no CMS/iframe/geometry/host-layout vocabulary.",
    );
    process.exit(1);
  }
  console.log(
    `Neutrality guard (NFR-001) passed — ${SCANNED_DIRS.join(", ")} are clean.`,
  );
}

// Run only when invoked directly (not when imported by the Vitest test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
