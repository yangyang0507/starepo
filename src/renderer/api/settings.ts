import type { AppSettings, LogLevel } from "@shared/types";

function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new Error("ElectronAPI is not available. Make sure preload script is loaded.");
  }
}

export const settingsAPI = {
  getSettings: async (): Promise<AppSettings> => {
    ensureElectronAPI();
    const result = await window.electronAPI.settings.getSettings();
    if (!result.success) {
      throw new Error(result.error || "获取应用设置失败");
    }
    return result.data as AppSettings;
  },

  updateSettings: async (update: Partial<AppSettings>): Promise<AppSettings> => {
    ensureElectronAPI();
    const result = await window.electronAPI.settings.updateSettings(update);
    if (!result.success) {
      throw new Error(result.error || "更新应用设置失败");
    }
    return result.data as AppSettings;
  },

  resetSettings: async (): Promise<AppSettings> => {
    ensureElectronAPI();
    const result = await window.electronAPI.settings.resetSettings();
    if (!result.success) {
      throw new Error(result.error || "重置应用设置失败");
    }
    return result.data as AppSettings;
  },
};

export const logLevelLabels: Record<LogLevel, string> = {
  debug: "Debug 调试",
  info: "Info 信息",
  warn: "Warn 警告",
  error: "Error 错误",
};
