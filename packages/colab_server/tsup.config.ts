import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["colab-protocol", "socket.io"],
  // Non-composite tsconfig for tsup's dts step (see protocol/tsup.config.ts).
  tsconfig: "tsconfig.dts.json",
});
