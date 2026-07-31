import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/**
 * Resolve `colab-*` specifiers to package SOURCE in tests, so `pnpm test`
 * runs without a prior build and always exercises current source.
 */
const colabAliases = {
  "colab-protocol": r("./packages/protocol/src/index.ts"),
  "colab-ui": r("./packages/colab_ui/src/index.ts"),
  "colab-server": r("./packages/colab_server/src/index.ts"),
};

/**
 * Root Vitest config for the `colab` monorepo (T6 / PROJ-T-0021).
 *
 * Uses Vitest 3 `projects` mode: each real package is its own project so a
 * single `pnpm test` (`vitest run`) executes every package's suite with proper
 * isolation. Native ESM/TypeScript — no extra transform needed given
 * `type: "module"`. Coverage provider is set (v8) but thresholds are DEFERRED
 * until real code lands (I2+). Nothing here encodes CMS/iframe/geometry.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "protocol",
          root: "./packages/protocol",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: colabAliases },
        test: {
          name: "colab_ui",
          root: "./packages/colab_ui",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          // The React binding (src/react/**) needs a DOM; the framework-free
          // core keeps running under plain node for speed and to prove its
          // DOM-freedom. Per-file environment selection gives both.
          environmentMatchGlobs: [["src/react/**", "jsdom"]],
        },
      },
      {
        resolve: { alias: colabAliases },
        test: {
          name: "colab_server",
          root: "./packages/colab_server",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      // I3 (PROJ-I-0003) enforces the 90%+ target on its three seam-default
      // modules: store, transport, and identity. Coverage is scoped to those
      // implementation files; re-export barrels (`index.ts`), the reusable
      // contract-suite harnesses (exercised via wrappers), tests, and unrelated
      // packages are excluded so the gate measures real seam logic.
      include: [
        "packages/colab_ui/src/store/**/*.ts",
        "packages/colab_ui/src/transport/**/*.ts",
        "packages/colab_ui/src/identity/**/*.ts",
      ],
      exclude: [
        "**/index.ts",
        "**/*.test.ts",
        "**/storeContract.ts",
        "**/transportContract.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
