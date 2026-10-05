import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/**/index.ts",
        "src/lib/**/api.ts",
        "src/lib/**/repository.ts",
        "src/lib/discovery/scan-service.ts",
        "src/lib/discovery/stored-seen-store.ts"
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 65 },
    },
  },
});
