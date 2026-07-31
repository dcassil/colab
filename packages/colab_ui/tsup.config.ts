import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/react/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // `react`/`react-dom` are PEER deps — never bundle them. `colab-protocol`
  // stays external as before.
  external: ["colab-protocol", "react", "react-dom", "react/jsx-runtime"],
  // Non-composite tsconfig for tsup's dts step (see protocol/tsup.config.ts).
  tsconfig: "tsconfig.dts.json",
});
