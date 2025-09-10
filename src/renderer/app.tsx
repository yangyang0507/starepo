import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./localization/i18n";
import { updateAppLanguage } from "./utils/language-helpers";
import AuthGuard from "./components/auth/auth-guard";
import { ErrorBoundary } from "./components/error-boundary";

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // 只处理语言初始化，主题初始化由useTheme hook处理
    updateAppLanguage(i18n);
  }, [i18n]);

  return (
    <ErrorBoundary>
      <AuthGuard />
    </ErrorBoundary>
  );
}
