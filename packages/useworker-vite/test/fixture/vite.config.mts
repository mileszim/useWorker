import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// Import the built plugin, exactly as a consumer would.
import { useworkerVite } from "../../dist/index.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), useworkerVite()],
  // Output to `dist` so it's covered by the repo's Biome/ignore rules (the
  // minified worker/React bundles must not be linted).
  build: { outDir: "dist", emptyOutDir: true },
});
