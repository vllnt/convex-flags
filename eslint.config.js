import convex from "@vllnt/eslint-config/convex";

export default [
  { ignores: ["example/**", "dist/**", "src/component/_generated/**", "coverage/**"] },
  ...convex,
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
