import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * TC-002 (belt-and-suspenders with the depcruise `no-socketio-from-core-barrel`
 * rule): scan the STATIC import graph reachable from the package barrel and
 * assert no file statically imports `socket.io-client`. Only `socket.io-client`
 * reached via `await import(...)` is allowed; a top-level `import ... from
 * "socket.io-client"` (value OR type) in any barrel-reachable file fails here.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, "..");
const BARREL = resolve(SRC_ROOT, "index.ts");

/** Strip block and line comments so prose examples never match as imports. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Static import/re-export: `import|export` ... `from "spec"`, where the gap
// contains no `;` (cannot leap across a statement) but may span newlines.
const STATIC_FROM = /\b(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g;
const SIDE_EFFECT = /^\s*import\s+["']([^"']+)["']/gm;

function resolveLocal(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined; // external package, not a local edge
  // Source uses ESM `.js` specifiers that map to sibling `.ts` sources.
  return resolve(dirname(fromFile), spec).replace(/\.js$/, ".ts");
}

function staticSpecs(file: string): string[] {
  const text = stripComments(readFileSync(file, "utf8"));
  const specs: string[] = [];
  for (const m of text.matchAll(STATIC_FROM)) if (m[1]) specs.push(m[1]);
  for (const m of text.matchAll(SIDE_EFFECT)) if (m[1]) specs.push(m[1]);
  return specs;
}

function walk(): { files: Set<string>; externals: Set<string> } {
  const files = new Set<string>();
  const externals = new Set<string>();
  const queue = [BARREL];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || files.has(file)) continue;
    files.add(file);
    for (const spec of staticSpecs(file)) {
      const local = resolveLocal(file, spec);
      if (local === undefined) externals.add(spec);
      else queue.push(local);
    }
  }
  return { files, externals };
}

describe("socket-free core barrel (graph scan)", () => {
  it("has no static import path from the barrel to socket.io-client", () => {
    const { files, externals } = walk();
    expect([...externals]).not.toContain("socket.io-client");
    // The transport IS reachable, proving the scan walked into it — otherwise
    // the absence above would be vacuously true.
    expect([...files].some((f) => f.endsWith("socketIoTransport.ts"))).toBe(
      true,
    );
  });
});
