import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Hex (#f38121), rgb()/hsl()/oklch() colours in code. Colours must come from
// the design tokens in styles/tokens.css (e.g. bg-primary, text-heading).
const HARD_CODED_COLOR = String.raw`/#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b|\b(?:rgba?|hsla?|oklch|oklab)\(/`;
const COLOR_MESSAGE =
  "Don't hard-code colours. Use a design token from styles/tokens.css (e.g. bg-primary, text-heading). See /style-guide.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "features/**/*.{ts,tsx}"],
    ignores: ["app/manifest.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${HARD_CODED_COLOR}]`, message: COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=${HARD_CODED_COLOR}]`, message: COLOR_MESSAGE },
      ],
    },
  },
  // Must stay last: turns off ESLint rules that conflict with Prettier.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
