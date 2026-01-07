import * as path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      "@main": path.resolve(__dirname, "./src/main"),
      "@preload": path.resolve(__dirname, "./src/preload"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@assets": path.resolve(__dirname, "./src/assets"),
    },
  },
  test: {
    include: ["src/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["src/tests/e2e/**/*"],
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/unit/setup.ts",
    css: true,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/main/**/*.ts",
        "src/renderer/**/*.{ts,tsx}",
        "src/shared/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/tests/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/out/**",
        "**/*.d.ts",
        "**/types/**",
        "**/*.config.{ts,js}",
        "**/main.ts",
        "**/preload.ts",
      ],
      thresholds: {
        lines: 5,
        functions: 50,
        branches: 5,
        statements: 5,
      },
    },
  },
});
