import convex from "@vllnt/eslint-config/convex";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["example/**", "dist/**", "src/component/_generated/**", "coverage/**"] },
  ...convex,
  // Apply convex rules to component source (same structure as a convex/ folder)
  {
    files: ["src/component/**/*.ts"],
    ignores: ["src/component/_generated/**"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "convex-rules/standard-filenames": "error",
      "convex-rules/namespace-separation": "error",
      "convex-rules/snake-case-filenames": "error",
      "convex-rules/no-bare-v-any": "error",
      "convex-rules/require-returns-validator": "error",
      "convex-rules/no-query-in-loop": "error",
      "convex-rules/no-filter-on-query": "error",
    },
  },
  // Exempt config, validator, and schema files from strict naming rules
  {
    files: [
      "src/component/convex.config.ts",
      "src/component/validators.ts",
      "src/component/schema.ts",
    ],
    rules: {
      "convex-rules/standard-filenames": "off",
      "convex-rules/namespace-separation": "off",
    },
  },
];
