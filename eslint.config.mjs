import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Client pages poll/load data in effects; cascading render warning is noisy here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Metro loads its config as CommonJS, so `require` is the only form that
    // works in these files.
    files: ["apps/*/metro.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // React Native resolves static images through `require()` with a literal
    // path; an `import` needs a `*.png` module declaration that Expo does not
    // ship here, so requiring the asset is the supported form.
    files: ["apps/*/components/brand.tsx"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
