import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./localization/i18n";
import { updateAppLanguage } from "./utils/language-helpers";
import AuthGuard from "./components/auth/auth-guard";
import { ErrorBoundary } from "./components/error-boundary";
import { useThemeStore } from "./stores/theme-store";

export default function App() {
  const { i18n } = useTranslation();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    // Initialize language and theme
    updateAppLanguage(i18n);
    initTheme();
  }, [i18n, initTheme]);

  return (
    <ErrorBoundary>
      <AuthGuard />
    </ErrorBoundary>
  );
}
