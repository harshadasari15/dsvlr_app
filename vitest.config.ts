import { defineConfig } from "vitest/config";

export default defineConfig({
  // Lets tests render the web app's TSX components.
  esbuild: { jsx: "automatic" },
  test: { include: ["packages/**/*.test.ts", "apps/**/*.test.ts"] },
});
