import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    exclude: ["**/node_modules/**", "dist/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      // List every source file that must be covered. Adding a source file here
      // without a matching test fails CI — that is the 100% E2E coverage gate.
      include: [
        "src/shared.ts",
        "src/client/index.ts",
        "src/component/mutations.ts",
        "src/component/queries.ts",
        "src/component/validators.ts",
        "src/component/schema.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
