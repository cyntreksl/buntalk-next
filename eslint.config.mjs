import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Hex (#f38121), rgb()/hsl()/oklch() colours in code. Colours must come from
// the design tokens in styles/tokens.css (e.g. bg-primary, text-heading).
const HARD_CODED_COLOR = String.raw`/#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b|\b(?:rgba?|hsla?|oklch|oklab)\(/`;
const COLOR_MESSAGE =
  "Don't hard-code colours. Use a design token from styles/tokens.css (e.g. bg-primary, text-heading). See /style-guide.";
const colorRules = [
  { selector: `Literal[value=${HARD_CODED_COLOR}]`, message: COLOR_MESSAGE },
  { selector: `TemplateElement[value.raw=${HARD_CODED_COLOR}]`, message: COLOR_MESSAGE },
];

// The ERP is only reached through lib/erp (BUN-159): one shared client, and
// ERP settings/credentials read in one server-only place.
const ERP_MESSAGE =
  "Talk to the ERP only through the typed functions exported from \"@/lib/erp\" (see README 'ERP client').";
const erpSyntaxRules = [
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^ERP_/]",
    message: `${ERP_MESSAGE} ERP_* settings are read only in lib/env.server.ts.`,
  },
];
const erpImportRules = {
  patterns: [
    {
      group: ["@/lib/erp/*", "**/lib/erp/*"],
      message: `${ERP_MESSAGE} Its internals (http, schemas, mappers) are private.`,
    },
  ],
  paths: [
    {
      name: "@/lib/env.server",
      importNames: ["erpConfig"],
      message: `${ERP_MESSAGE} ERP settings are only used inside lib/erp.`,
    },
  ],
};
const ERP_INTERNAL_FILES = [
  "lib/erp/**",
  "lib/env.server.ts",
  // Standalone CLI (not part of the app): signs test webhooks with ERP_WEBHOOK_SECRET.
  "scripts/send-erp-webhook.mjs",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    ignores: ERP_INTERNAL_FILES,
    rules: {
      "no-restricted-imports": ["error", erpImportRules],
      "no-restricted-syntax": ["error", ...erpSyntaxRules],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "features/**/*.{ts,tsx}"],
    ignores: ["app/manifest.ts"],
    rules: {
      // Repeats the ERP rules: a later "no-restricted-syntax" replaces the earlier one.
      "no-restricted-syntax": ["error", ...colorRules, ...erpSyntaxRules],
    },
  },
  // Must stay last: turns off ESLint rules that conflict with Prettier.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
