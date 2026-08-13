import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": process.cwd(),
      // Next compiles this marker to a no-op in its server test environment; use the same behaviour
      // when importing server-only database modules directly in Vitest.
      "server-only": path.join(process.cwd(), "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
  },
});
