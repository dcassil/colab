import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["colab-protocol"],
  // Non-composite tsconfig for tsup's dts step (see protocol/tsup.config.ts).
  tsconfig: "tsconfig.dts.json",
});
