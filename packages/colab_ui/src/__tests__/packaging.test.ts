import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

interface PackageSpec {
  name: string;
  dir: string;
  dependencies?: Record<string, string>;
}

interface PackFile {
  path: string;
}

interface PackResult {
  files: PackFile[];
}

const repoRoot = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const npmCache = path.join(tmpdir(), "colab-npm-cache");

const specs: PackageSpec[] = [
  { name: "colab-protocol", dir: "packages/protocol" },
  {
    name: "colab-ui",
    dir: "packages/colab_ui",
    dependencies: { "colab-protocol": "0.1.0" },
  },
  {
    name: "colab-server",
    dir: "packages/colab_server",
    dependencies: { "colab-protocol": "0.1.0", "socket.io": "4.8.1" },
  },
];

beforeAll(() => {
  execFileSync("pnpm", ["-r", "--filter", "./packages/*", "build"], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}, 120_000);

describe("publish packaging", () => {
  it("keeps package metadata publishable and lockstep", () => {
    const versions = new Set<string>();

    for (const spec of specs) {
      const pkg = readPackageJson(spec);
      expect(readString(pkg, "name")).toBe(spec.name);
      expect(spec.name.startsWith("@")).toBe(false);
      expect(readString(pkg, "version")).toMatch(/^0\.\d+\.\d+$/u);
      versions.add(readString(pkg, "version"));
      expect(readStringArray(pkg, "files")).toStrictEqual([
        "dist",
        "README.md",
        "LICENSE",
      ]);
      expect(readString(pkg, "types")).toBe("./dist/index.d.ts");
      expect(readString(pkg, "license")).toBe("MIT");
      expect(readString(readRecord(pkg, "publishConfig"), "access")).toBe(
        "public",
      );
      expect(readString(readRecord(pkg, "repository"), "url")).toContain(
        "github.com/dcassil/colab",
      );
      expect(readString(readRecord(pkg, "repository"), "directory")).toBe(
        spec.dir,
      );
      expectDependencyRanges(pkg, spec.dependencies ?? {});
    }

    expect([...versions]).toStrictEqual(["0.1.0"]);
  });

  it("packs only the npm metadata and the files allowlist", () => {
    for (const spec of specs) {
      const packed = npmPackDryRun(spec);
      const paths = packed.files.map((file) => normalizePackPath(file.path));
      expect(paths).toContain("package.json");
      expect(paths).toContain("README.md");
      expect(paths).toContain("LICENSE");
      expect(paths.some((filePath) => filePath.startsWith("dist/"))).toBe(true);

      for (const filePath of paths) {
        expect(isAllowedPackedFile(filePath), filePath).toBe(true);
      }
    }
  });

  it("points every export at a built, importable artifact", async () => {
    for (const spec of specs) {
      const pkg = readPackageJson(spec);
      const exportsMap = readRecord(pkg, "exports");

      for (const target of collectExportTargets(exportsMap)) {
        expect(target).not.toContain("src/");
        expect(target).toMatch(/^\.\/(?:dist\/|package\.json$)/u);
        expect(existsSync(path.join(repoRoot, spec.dir, target))).toBe(true);
      }

      for (const importTarget of collectCondition(exportsMap, "import")) {
        await import(pathToFileURL(path.join(repoRoot, spec.dir, importTarget)).href);
      }

      expect(collectCondition(exportsMap, "require")).toStrictEqual([]);
    }
  });
});

function readPackageJson(spec: PackageSpec): Record<string, unknown> {
  const json = readFileSync(path.join(repoRoot, spec.dir, "package.json"), "utf8");
  const parsed = JSON.parse(json) as unknown;
  if (!isRecord(parsed)) throw new Error(`${spec.name} package.json is invalid`);
  return parsed;
}

function npmPackDryRun(spec: PackageSpec): PackResult {
  const output = execFileSync("npm", ["pack", "--json", "--dry-run"], {
    cwd: path.join(repoRoot, spec.dir),
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: npmCache },
  });
  const parsed = JSON.parse(output) as unknown;
  if (!Array.isArray(parsed) || !isPackResult(parsed[0])) {
    throw new Error(`${spec.name} npm pack --json returned an unexpected shape`);
  }
  return parsed[0];
}

function collectExportTargets(exportsMap: Record<string, unknown>): string[] {
  return Object.values(exportsMap).flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (!isRecord(entry)) return [];
    return ["types", "import", "require"].flatMap((condition) => {
      const target = entry[condition];
      return typeof target === "string" ? [target] : [];
    });
  });
}

function collectCondition(
  exportsMap: Record<string, unknown>,
  condition: string,
): string[] {
  return Object.values(exportsMap).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const target = entry[condition];
    return typeof target === "string" ? [target] : [];
  });
}

function expectDependencyRanges(
  pkg: Record<string, unknown>,
  expected: Record<string, string>,
): void {
  const dependencies = readOptionalRecord(pkg, "dependencies");
  for (const [name, range] of Object.entries(expected)) {
    expect(dependencies?.[name]).toBe(range);
    expect(dependencies?.[name]).not.toMatch(/^workspace:/u);
  }
}

function isAllowedPackedFile(filePath: string): boolean {
  return (
    filePath === "package.json" ||
    filePath === "README.md" ||
    filePath === "LICENSE" ||
    filePath.startsWith("dist/")
  );
}

function normalizePackPath(filePath: string): string {
  return filePath.startsWith("package/") ? filePath.slice("package/".length) : filePath;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be a string array`);
  }
  return value;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`${key} must be an object`);
  return value;
}

function readOptionalRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${key} must be an object`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPackResult(value: unknown): value is PackResult {
  return (
    isRecord(value) &&
    Array.isArray(value.files) &&
    value.files.every((file) => isRecord(file) && typeof file.path === "string")
  );
}
