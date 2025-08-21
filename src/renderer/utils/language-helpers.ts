import type { i18n } from "i18next";

const languageLocalStorageKey = "language";

export function setAppLanguage(lang: string, i18n: i18n) {
  console.log(`Setting language to: ${lang}`); // 添加调试日志
  localStorage.setItem(languageLocalStorageKey, lang);
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export function updateAppLanguage(i18n: i18n) {
  const localLang = localStorage.getItem(languageLocalStorageKey);
  console.log(`Found stored language: ${localLang}`); // 添加调试日志
  if (!localLang) {
    console.log("No stored language, using default"); // 添加调试日志
    return;
  }

  i18n.changeLanguage(localLang);
  document.documentElement.lang = localLang;
}
