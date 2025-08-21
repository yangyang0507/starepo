import type { ElectronAPI } from "./preload";

/**
 * 扩展全局 Window 接口，添加 electronAPI
 * 这样在渲染进程中就可以通过 window.electronAPI 访问主进程功能
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
