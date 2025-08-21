import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { setAppLanguage } from "@/utils/language-helpers";

export default function LangToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "zh-CN" ? "en" : "zh-CN";
    setAppLanguage(newLang, i18n);
  };

  const getLanguageLabel = (language: string) => {
    switch (language) {
      case "zh-CN":
        return "🇨🇳 中文";
      case "en":
        return "🇺🇸 English";
      default:
        return "🇺🇸 English";
    }
  };

  return (
    <Button onClick={toggleLanguage} variant="outline" size="sm">
      {getLanguageLabel(i18n.language)}
    </Button>
  );
}
