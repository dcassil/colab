// @ts-check
/**
 * Strict guard-rails flat config for the `colab` monorepo.
 *
 * Layers established here (T3 / PROJ-T-0017):
 *   1. typescript-eslint strictTypeChecked + stylisticTypeChecked (type-aware),
 *      wired via `projectService` so type rules run across every package.
 *   2. SIZE / COMPLEXITY ceilings on non-test source (ecosystem-parity numbers
 *      matching the sibling frame-link / stardust-* repos).
 *   3. A total ban on escape hatches: `any`, non-null assertions, TS suppression
 *      comments (`@ts-ignore` / `@ts-expect-error`), and inline `eslint-disable`.
 *   4. Narrow, justified overrides for test files and the reserved example slot.
 *
 * MODULE BOUNDARIES (eslint-plugin-boundaries) are added in T4 (PROJ-T-0019);
 * dependency-cruiser mirrors them in T5 (PROJ-T-0020). This config must remain
 * un-weakened — no rule-disabling to make the skeletons pass (NFR-004).
 *
 * Nothing here encodes CMS / iframe / geometry assumptions.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    // Not linted: build output, deps, the reserved example app (no source yet
    // and its own future toolchain), and the root config file itself.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "eslint.config.mjs",
    ],
  },

  js.configs.recommended,

  // Type-aware strict rules apply to every package's `src` program.
  ...tseslint.configs.strictTypeChecked.map((c) => ({
    ...c,
    files: ["packages/*/src/**/*.{ts,tsx}"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({
    ...c,
    files: ["packages/*/src/**/*.{ts,tsx}"],
  })),

  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@eslint-community/eslint-comments": eslintComments,
    },
    rules: {
      /* ---- SIZE / COMPLEXITY (non-test source) ---- */
      "max-lines": [
        "error",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],

      /* ---- ESCAPE HATCHES BANNED ---- */
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-expect-error": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@eslint-community/eslint-comments/no-use": ["error", { allow: [] }],
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",

      /* ---- PUBLIC-ENTRY DISCIPLINE (cross-package) ----
       * Reinforces the boundaries `fileInternalPath: "index.ts"` policy: a
       * sibling package must be imported by its bare name (its public entry),
       * never by reaching into its `src`/`dist` internals. Deep subpaths also
       * bypass the boundaries element resolver, so this ban closes that gap. */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@colab/*/src/**", "@colab/*/dist/**", "@colab/*/src"],
              message:
                "Public-entry discipline: import a sibling package by its name " +
                "(its index.ts public entry), never by reaching into its src/dist internals.",
            },
          ],
        },
      ],
    },
  },

  // TEST OVERRIDE — relax size ergonomics for tests; escape-hatch bans STAY on.
  {
    files: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "packages/*/src/**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE BOUNDARIES (T4 / PROJ-T-0019) — cross-package architecture graph.
  //
  // THE single source of truth for the allowed dependency edges; T5's
  // dependency-cruiser config (PROJ-T-0020) mirrors this VERBATIM.
  //
  // Element types (by package folder):
  //   protocol      → packages/protocol/**   (shared leaf wire contract)
  //   colab_ui      → packages/colab_ui/**   (client library)
  //   colab_server  → packages/colab_server/** (relay server)
  //   example       → example/**             (reserved app slot)
  //
  // ALLOWED EDGES (everything else is disallowed by default):
  //   colab_ui     → protocol      (via protocol's public entry only)
  //   colab_server → protocol      (via protocol's public entry only)
  //   example      → colab_ui      (via colab_ui's public entry only;
  //                                 protocol reachable only transitively)
  //   protocol     → (nothing internal — it is the leaf)
  //
  // FORBIDDEN (must be rejected): colab_ui ↔ colab_server (either direction);
  //   any import INTO protocol from a sibling; example → colab_server;
  //   and any cross-package import that bypasses the target's index.ts entry.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["packages/*/src/**/*.{ts,tsx}", "example/src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    languageOptions: {
      // TS syntax parsing (type-free) so boundaries can run on every element,
      // including the reserved `example` slot which has no tsconfig program yet.
      parser: tseslint.parser,
    },
    settings: {
      // Silence v5/v6 legacy-syntax advisories — this config uses only the v7
      // object-selector / `policies` API below.
      "boundaries/legacy-warnings": false,
      "boundaries/dependency-nodes": ["import"],
      // Resolve the `@colab/*` workspace specifiers to each package's SOURCE
      // entry (not its built `dist`), so boundaries classifies cross-package
      // imports as the sibling element rather than an external dependency.
      // This mirrors the workspace graph the build resolves via `exports`.
      "import/resolver": {
        alias: {
          map: [
            ["@colab/protocol", "./packages/protocol/src/index.ts"],
            ["@colab/ui", "./packages/colab_ui/src/index.ts"],
            ["@colab/server", "./packages/colab_server/src/index.ts"],
          ],
          extensions: [".ts", ".tsx", ".js"],
        },
      },
      // Folder-based classification (v7 default). `src` is the internal root of
      // each element, so the barrel `src/index.ts` is the element's public
      // entry, expressed downstream via `fileInternalPath: "index.ts"`.
      "boundaries/elements": [
        { type: "protocol", partialMatch: false, pattern: "packages/protocol/src" },
        { type: "colab_ui", partialMatch: false, pattern: "packages/colab_ui/src" },
        {
          type: "colab_server",
          partialMatch: false,
          pattern: "packages/colab_server/src",
        },
        { type: "example", partialMatch: false, pattern: "example/src" },
      ],
    },
    rules: {
      "boundaries/no-unknown-dependencies": "error",
      "boundaries/no-unknown-files": "error",
      // v7 `dependencies` replaces the deprecated `element-types` + `entry-point`
      // rules, folding two concerns into one policy list:
      //   (a) ALLOWED CROSS-PACKAGE EDGES (was element-types), and
      //   (b) PUBLIC-ENTRY DISCIPLINE — an allowed import must resolve to the
      //       target package's `index.ts` barrel (was entry-point), via the
      //       `fileInternalPath: "index.ts"` target selector.
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Boundary violation: '{{from.type}}' may not import '{{to.type}}'. " +
            "Allowed edges: colab_ui→protocol, colab_server→protocol, example→colab_ui. " +
            "protocol is the shared leaf and imports no sibling.",
          policies: [
            {
              from: { element: { type: "colab_ui" } },
              allow: {
                to: {
                  element: { type: "protocol", fileInternalPath: "index.ts" },
                },
              },
              message:
                "Boundary violation: 'colab_ui' may import only 'protocol', and only " +
                "through its public entry (index.ts) — not '{{to.internalPath}}'. " +
                "colab_ui and colab_server must NOT depend on each other; communicate via protocol.",
            },
            {
              from: { element: { type: "colab_server" } },
              allow: {
                to: {
                  element: { type: "protocol", fileInternalPath: "index.ts" },
                },
              },
              message:
                "Boundary violation: 'colab_server' may import only 'protocol', and only " +
                "through its public entry (index.ts) — not '{{to.internalPath}}'. " +
                "colab_server and colab_ui must NOT depend on each other; communicate via protocol.",
            },
            {
              from: { element: { type: "example" } },
              allow: {
                to: {
                  element: { type: "colab_ui", fileInternalPath: "index.ts" },
                },
              },
              message:
                "Boundary violation: 'example' may import only 'colab_ui' (protocol is reached " +
                "transitively), and only through its public entry (index.ts) — not '{{to.internalPath}}'. " +
                "example must never import colab_server.",
            },
            // protocol: no `from` policy → every cross-package import from
            // protocol hits the default disallow. protocol is the shared leaf
            // contract; it must not import from siblings.
          ],
        },
      ],
    },
  },

  // TEST OVERRIDE (boundaries) — placed AFTER the boundaries block so it wins.
  // Test files are graph leaves that legitimately reach across packages to
  // exercise them directly; they are not part of the architecture graph.
  // The escape-hatch bans (any / ts-comment / eslint-disable) remain in force.
  {
    files: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "packages/*/src/**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "boundaries/dependencies": "off",
      "boundaries/no-unknown-dependencies": "off",
      "boundaries/no-unknown-files": "off",
      "no-restricted-imports": "off",
    },
  },
);
