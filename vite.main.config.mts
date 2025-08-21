import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@main": path.resolve(__dirname, "./src/main"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
