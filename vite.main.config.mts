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
  build: {
    rollupOptions: {
      external: [
        // 将 LanceDB 标记为外部依赖，不进行打包
        '@lancedb/lancedb',
        'apache-arrow',
        // 排除所有原生模块
        /\.node$/,
        // 排除特定的 LanceDB 原生模块
        /@lancedb\/lancedb-.*\/.*\.node$/,
      ],
      output: {
        format: 'cjs', // 确保使用 CommonJS 格式
      },
    },
    commonjsOptions: {
      // 忽略原生模块
      ignore: ['@lancedb/lancedb', 'apache-arrow']
    },
  },
  optimizeDeps: {
    exclude: [
      // 排除 LanceDB 相关包，避免预构建
      '@lancedb/lancedb',
      'apache-arrow'
    ],
  },
  define: {
    // 防止 Node.js 模块在浏览器环境中出错
    'process.env.NODE_ENV': '"development"'
  },
  // 添加插件来处理原生模块
  plugins: [
    {
      name: 'exclude-native-modules',
      load(id) {
        if (id.endsWith('.node')) {
          return 'module.exports = {}';
        }
      },
      resolveId(id) {
        if (id.endsWith('.node')) {
          return id;
        }
      }
    }
  ],
});
