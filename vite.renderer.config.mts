import * as path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      "@preload": path.resolve(__dirname, "./src/preload"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@assets": path.resolve(__dirname, "./src/assets"),
    },
  },
  define: {
    __dirname: JSON.stringify(path.resolve(__dirname, "./src/renderer")),
    __filename: JSON.stringify(
      path.resolve(__dirname, "./src/renderer/index.js"),
    ),
    global: "globalThis",
  },
  optimizeDeps: {
    exclude: ["electron"],
  },
});
