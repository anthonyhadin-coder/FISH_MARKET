import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import baseConfig from "@fishmarket/eslint-config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...baseConfig, // Put baseConfig later to let its overrides win, or add explicit overrides here.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off", // This rule is too strict for the current codebase
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "frontend_lint_errors*.txt",
  ]),
]);

export default eslintConfig;
