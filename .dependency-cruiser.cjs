/**
 * dependency-cruiser configuration for the `colab` monorepo.
 *
 * INDEPENDENT SECOND ENFORCEMENT of the module-boundary graph (defense in
 * depth). The `forbidden` rules below mirror — one-to-one — the authoritative
 * graph declared in `eslint.config.mjs` (T4 / PROJ-T-0019):
 *
 *   ALLOWED EDGES:
 *     colab_ui     → protocol
 *     colab_server → protocol
 *     example      → colab_ui   (protocol reached transitively)
 *     protocol     → (nothing internal — the shared leaf contract)
 *
 *   FORBIDDEN (rejected here AND by ESLint boundaries):
 *     - any import INTO protocol from a sibling other than its public entry
 *     - colab_ui ↔ colab_server (either direction)
 *     - example → colab_server
 *     - reaching into a package's internals instead of its public entry
 *     - circular deps; orphan modules
 *
 * RESOLUTION NOTE: cross-package `colab-*` specifiers resolve (via each
 * package's `exports`) to the sibling's BUILT output — `dist/index.*`. That
 * built barrel IS the package's public entry, so the leaf/deep-import rules
 * treat `dist/index.{js,d.ts}` as the sole legal cross-package target and
 * forbid reaching into any other `dist/**` or `src/**` file of a sibling.
 * `dist/**` is excluded from being scanned as a source root (so built files
 * are not mistaken for orphans) but is still followed as a dependency target.
 *
 * Where ESLint validates source AST, dependency-cruiser validates the resolved
 * import graph — so a bypass of one layer is still caught by the other.
 *
 * Nothing here encodes CMS / iframe / geometry assumptions.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */

// A sibling package's public entry: its built barrel `dist/index.{js,d.ts}`.
const PUBLIC_ENTRY = "/dist/index\\.(js|d\\.ts)$";

module.exports = {
  forbidden: [
    /* ---- Leaf invariant: nothing may import INTO protocol (except entry) - */
    {
      name: "no-import-into-protocol",
      comment:
        "protocol is the shared leaf wire contract; siblings (colab_ui / " +
        "colab_server / example) may consume ONLY its public entry and must not " +
        "reach into its internals. protocol itself depends on no sibling.",
      severity: "error",
      from: {
        path: "^packages/(colab_ui|colab_server)/src",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      to: {
        path: "^(packages/protocol/|colab-protocol/(src|dist)/)",
        pathNot: PUBLIC_ENTRY,
      },
    },
    {
      name: "protocol-imports-no-sibling",
      comment:
        "protocol is the shared leaf: it must import NO sibling package " +
        "(colab_ui / colab_server / example). It only exposes shared types.",
      severity: "error",
      from: { path: "^packages/protocol/src", pathNot: "\\.(test|spec)\\.[tj]sx?$" },
      to: {
        path:
          "^(packages/(colab_ui|colab_server)/|example/|colab-(ui|server)($|/))",
      },
    },

    /* ---- colab_ui ↔ colab_server forbidden (both directions) ------------- */
    {
      name: "ui-not-to-server",
      comment:
        "colab_ui and colab_server must NOT depend on each other. They share " +
        "state only through the protocol wire contract — never a direct edge.",
      severity: "error",
      from: {
        path: "^packages/colab_ui/src",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      // Matches both a resolved path (if ever symlinked) and the bare specifier.
      // `colab-server` is deliberately NOT a dependency of colab_ui, so the
      // import is also unresolvable — caught here rather than silently ignored.
      to: { path: "^(packages/colab_server/|colab-server($|/))" },
    },
    {
      name: "server-not-to-ui",
      comment:
        "colab_server and colab_ui must NOT depend on each other. They share " +
        "state only through the protocol wire contract — never a direct edge.",
      severity: "error",
      from: {
        path: "^packages/colab_server/src",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      to: { path: "^(packages/colab_ui/|colab-ui($|/))" },
    },

    /* ---- example may reach only colab_ui / protocol, never colab_server -- */
    {
      name: "example-not-to-server",
      comment:
        "example may consume only colab_ui (protocol transitively). It must " +
        "NEVER import colab_server — the relay is a separate deployment concern.",
      severity: "error",
      from: { path: "^example/src" },
      to: { path: "^(packages/colab_server/|colab-server($|/))" },
    },

    /* ---- Socket-free barrel: no STATIC edge to socket.io-client --------- */
    {
      name: "no-socketio-from-core-barrel",
      comment:
        "socket.io-client is an OPTIONAL battery. colab_ui source may reference " +
        "it ONLY through a dynamic `await import(\"socket.io-client\")` inside the " +
        "SocketIoTransport — never via a static import (value OR type). A static " +
        "edge would put the whole socket.io graph on every consumer's static " +
        "path, defeating tree-shaking and the 'removable batteries' guarantee.",
      severity: "error",
      from: {
        path: "^packages/colab_ui/src",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      to: {
        path: "(^|/)socket\\.io-client($|/)|node_modules/socket\\.io-client",
        // A dynamic `import()` is the ONLY permitted reference; anything else
        // (a top-level `import ... from`, a type-only import) is a static edge.
        dependencyTypesNot: ["dynamic-import"],
      },
    },

    /* ---- Public-entry discipline (entry-point) --------------------------- */
    {
      name: "not-to-deep-import",
      comment:
        "Import a sibling package by its public entry (its built index barrel), " +
        "never by reaching into another package's src or non-entry dist files.",
      severity: "error",
      from: {
        path: "^(packages/colab_ui|packages/colab_server|example)/src",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      to: {
        // Cross-package specifiers resolve through `exports` to a sibling's
        // `dist`. Reaching any built file OTHER than the public entry barrel is
        // a deep import. (Same-package relative imports resolve within the
        // consumer's own `src` and are unaffected — they never hit `dist`.)
        path:
          "^(packages/(protocol|colab_ui|colab_server)/dist/|colab-(protocol|ui|server)/(src|dist)/)",
        pathNot: PUBLIC_ENTRY,
      },
    },

    /* ---- I5 interaction purity: no geometry/DOM/UI in interactions ------ */
    {
      name: "interactions-no-geometry-dom-ui",
      comment:
        "Interaction modules (interaction/ + interactions/) author PURE, " +
        "transform-free descriptors. The coordinate `transform` seam is the " +
        "ONLY route screen-space knowledge may enter, and it lives at the UI " +
        "render layer — never in an interaction. So interactions must NOT " +
        "import the coordinate/geometry module, the UI layer, the React " +
        "binding, or react/react-dom directly. They may consume only the I2/I3/" +
        "I4 public contracts (protocol, contracts/, core/) and the T1 factory.",
      severity: "error",
      from: {
        path: "^packages/colab_ui/src/interactions?/",
        pathNot: "\\.(test|spec)\\.[tj]sx?$",
      },
      to: {
        path: [
          "^packages/colab_ui/src/coordinate/",
          "^packages/colab_ui/src/ui/",
          "^packages/colab_ui/src/react/",
          "(^|/)react(-dom)?($|/)",
        ],
      },
    },

    /* ---- Hygiene -------------------------------------------------------- */
    {
      name: "no-circular",
      comment: "Circular dependencies make the module graph hard to reason about.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "Orphan modules (excluding config/entry/tests) are usually dead code.",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.",
          "(^|/)(vitest|dependency-cruiser)\\.",
          "(^|/)tsup\\.config\\.",
          "(^|/)src/index\\.[tj]s$",
          // Built barrels are the resolved cross-package entry, reached via a
          // package specifier (not a crawlable local edge) — not dead code.
          // Includes subpath entries (e.g. `dist/react/index.js`, the
          // `colab-ui/react` export barrel).
          "(^|/)dist/index\\.(js|d\\.ts)$",
          "(^|/)dist/[^/]+/index\\.(js|d\\.ts)$",
          "\\.(test|spec)\\.[tj]sx?$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default", "types"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
