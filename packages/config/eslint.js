import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const sharedRules = {
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
};

/**
 * Flat config for a Next.js app.
 * @param {string} baseDirectory - pass `import.meta.dirname`
 */
export function nextConfig(baseDirectory) {
  const compat = new FlatCompat({ baseDirectory });
  return [
    { ignores: [".next/**", "next-env.d.ts", "*.config.*"] },
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    {
      settings: { next: { rootDir: baseDirectory } },
      rules: sharedRules,
    },
  ];
}

/** Flat config for a React library package (packages/ui). */
export function reactLibraryConfig() {
  return tseslint.config(
    { ignores: ["dist/**", "*.config.*"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: { globals: { ...globals.browser } },
      rules: sharedRules,
    },
  );
}
