import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@preload": path.resolve(__dirname, "./src/preload"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
