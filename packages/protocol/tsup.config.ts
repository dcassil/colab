import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // tsup's dts step builds an in-memory program from the entry and inherits
  // `composite`; a composite program requires every reachable file to be in
  // its own file list, which the rollup-based dts step does not honour. This
  // dedicated non-composite tsconfig sidesteps that (TS6307) without touching
  // the composite `tsconfig.build.json` used by `tsc -b` project references.
  tsconfig: "tsconfig.dts.json",
});
