/**
 * 语言控制 API
 * 封装语言相关的electronAPI调用
 */

import type { Language } from "@shared/types";

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
 * 语言控制 API
 */
export const languageAPI = {
  getLanguage: async (): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.getLanguage();
    if (!result.success) {
      throw new Error(result.error || "Failed to get language");
    }
    return result.data as Language;
  },

  setLanguage: async (language: Language): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.setLanguage(language);
    if (!result.success) {
      throw new Error(result.error || "Failed to set language");
    }
    return result.data as Language;
  },

  onLanguageChanged: (callback: (language: Language) => void): (() => void) => {
    ensureElectronAPI();
    return window.electronAPI.language.onLanguageChanged(callback);
  },
};