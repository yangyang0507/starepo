/**
 * 窗口控制 API
 * 封装窗口操作相关的electronAPI调用
 */

/**
 * 检查 electronAPI 是否可用
 */
function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new Error(
      "ElectronAPI is not available. Make sure preload script is loaded.",
    );
  }
}

/**
 * 窗口控制 API
 */
export const windowAPI = {
  minimize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.minimize();
    if (!result.success) {
      throw new Error(result.error || "Failed to minimize window");
    }
  },

  maximize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.maximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to maximize window");
    }
  },

  close: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.close();
    if (!result.success) {
      throw new Error(result.error || "Failed to close window");
    }
  },

  toggleMaximize: async (): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.toggleMaximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle maximize");
    }
    return result.data?.isMaximized || false;
  },

  setFullscreen: async (fullscreen: boolean): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.setFullscreen(fullscreen);
    if (!result.success) {
      throw new Error(result.error || "Failed to set fullscreen");
    }
    return result.data?.isFullscreen || false;
  },
};