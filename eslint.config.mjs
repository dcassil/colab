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

export default tseslint.config(
  {
    // Not linted: build output, deps, the reserved example app (no source yet
    // and its own future toolchain), and the root config file itself.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "example/**",
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
);
