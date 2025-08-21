import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  lng: "en", // 设置默认语言
  debug: process.env.NODE_ENV === "development", // 开发模式下启用调试
  interpolation: {
    escapeValue: false, // React已经处理了XSS
  },
  resources: {
    en: {
      translation: {
        appName: "Starepo",
        titleHomePage: "Home Page",
        titleSecondPage: "Second Page",
      },
    },
    "zh-CN": {
      translation: {
        appName: "Starepo",
        titleHomePage: "首页",
        titleSecondPage: "第二页",
      },
    },
  },
});

export default i18n;
