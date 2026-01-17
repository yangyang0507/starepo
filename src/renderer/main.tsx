import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "./styles/global.css";

// 导入预加载脚本类型定义
import "@preload/types";

// 初始化全局错误处理器
import "./utils/global-error-handler";

// 初始化 ChatStore
import { initializeChatStore } from "./stores/chat-store";

// 确保 DOM 已加载
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }

  // 初始化 ChatStore
  initializeChatStore();

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

// 可选：在开发环境下显示一些调试信息
if (process.env.NODE_ENV === "development") {
  console.log("Renderer process started");
  console.log("ElectronAPI available:", !!window.electronAPI);
}
