import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
      "node_modules/**",
      "coverage/**",
      ".codex/**",
      ".client-build/**",
      "openspec/**",
      "scripts/*.mjs",
      "src/client/generated.ts",
      "tailwind.config.ts",
      "vite.client.config.ts",
      "*.config.js",
      "*.config.cjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: [
      "src/transcripts/**/*.ts",
      "src/reports/**/*.ts",
      "src/llm/**/*.ts",
      "src/shared/**/*.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-return": "error"
    }
  }
);
