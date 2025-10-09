import type { i18n } from "i18next";
import type { Language } from "@shared/types";
import { languageAPI } from "@/api";

const languageLocalStorageKey = "language";

export async function setAppLanguage(lang: string, i18n: i18n): Promise<void> {
  const targetLanguage = (lang as Language) ?? "en";
  try {
    await languageAPI.setLanguage(targetLanguage);
  } catch (error) {
    console.error("持久化语言设置失败:", error);
  }

  localStorage.setItem(languageLocalStorageKey, targetLanguage);
  i18n.changeLanguage(targetLanguage);
  document.documentElement.lang = targetLanguage;
}

export function updateAppLanguage(i18n: i18n): void {
  languageAPI
    .getLanguage()
    .then((persistedLanguage) => {
      const resolvedLanguage = persistedLanguage ?? (localStorage.getItem(languageLocalStorageKey) as Language | null) ?? "en";
      localStorage.setItem(languageLocalStorageKey, resolvedLanguage);
      i18n.changeLanguage(resolvedLanguage);
      document.documentElement.lang = resolvedLanguage;
    })
    .catch((error) => {
      console.error("获取持久化语言失败，回退至本地缓存", error);
      const fallbackLanguage = (localStorage.getItem(languageLocalStorageKey) as Language | null) ?? "en";
      i18n.changeLanguage(fallbackLanguage);
      document.documentElement.lang = fallbackLanguage;
    });
}
