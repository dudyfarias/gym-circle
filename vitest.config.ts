import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.claude/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      // Harness isolado usa `node:test` para não depender do app/Vitest.
      // Ele é validado por `node --test scripts/places-benchmark/*.test.mjs`.
      "**/scripts/places-benchmark/**/*.test.mjs",
    ],
  },
});
