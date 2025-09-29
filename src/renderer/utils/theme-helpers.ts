import { ThemeMode } from "@shared/types";
import { themeAPI } from "@/api";

const THEME_KEY = "theme";

export interface ThemePreferences {
  system: ThemeMode;
  local: ThemeMode | null;
}

export async function getCurrentTheme(): Promise<ThemePreferences> {
  const currentTheme = await themeAPI.getTheme();
  const localTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;

  return {
    system: currentTheme,
    local: localTheme,
  };
}

export async function setTheme(newTheme: ThemeMode) {
  await themeAPI.setTheme(newTheme);
  localStorage.setItem(THEME_KEY, newTheme);

  // 根据主题更新文档类
  if (newTheme === "dark") {
    updateDocumentTheme(true);
  } else if (newTheme === "light") {
    updateDocumentTheme(false);
  } else {
    // system theme - 获取当前系统主题
    const currentTheme = await themeAPI.getTheme();
    updateDocumentTheme(currentTheme === "dark");
  }
}

export async function toggleTheme() {
  const newTheme = await themeAPI.toggleTheme();
  updateDocumentTheme(newTheme === "dark");
  localStorage.setItem(THEME_KEY, newTheme);
}

export async function syncThemeWithLocal() {
  const { local } = await getCurrentTheme();
  if (!local) {
    setTheme("system");
    return;
  }

  await setTheme(local);
}

function updateDocumentTheme(isDarkMode: boolean) {
  if (!isDarkMode) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}
