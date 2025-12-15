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
        // AI Chat
        aiAssistant: "AI Assistant",
        startConversation: "Start a Conversation",
        askAboutRepositories: "Ask me anything about GitHub repositories",
        configured: "Configured",
        settings: "Settings",
        aiSettings: "AI Settings",
        loading: "Loading...",
        configureAI: "Configure AI",
        configureAIDescription: "Please configure your API Key and model settings first",
        goToConfigure: "Go to Configure",
        sendMessage: "Send",
        sendShortcut: "Press Ctrl/Cmd + Enter to send, Shift + Enter for new line",
        noMessages: "No messages yet",
        startChatting: "Start chatting",
        typeYourQuestion: "Type your question...",
        pleaseConfigureFirst: "Please configure AI settings first...",
        error: "Error",
        processingError: "Sorry, an error occurred while processing your request. Please try again.",

        // AI Settings Dialog
        aiProvider: "AI Provider",
        openaiDescription: "Use OpenAI's GPT models",
        anthropicDescription: "Use Anthropic's Claude models",
        deepseekDescription: "Use DeepSeek's models",
        ollamaDescription: "Use local Ollama models",
        apiKey: "API Key",
        apiKeyPlaceholder: "Enter your API Key",
        apiKeySecure: "Your API Key will be securely stored locally",
        llmModel: "LLM Model",
        maxTokens: "Max Tokens",
        temperature: "Temperature",
        temperatureDescription: "0-2, higher values are more random",
        advancedSettings: "Advanced Settings",
        save: "Save",
        cancel: "Cancel",
        saving: "Saving...",
        settingsSaved: "Settings saved",
        validationError: "Validation Error",
        pleaseEnterApiKey: "Please enter API Key",
        selectLlmModel: "Please select LLM model",
        maxTokensError: "Max Tokens must be a positive integer",
        temperatureError: "Temperature must be between 0-2",
        connectionTestFailed: "Connection test failed, please check your API Key and settings",

        // Repository References
        references: "References",
        language: "Language",
        stars: "Stars",
        relevance: "Relevance",
      },
    },
    "zh-CN": {
      translation: {
        appName: "Starepo",
        titleHomePage: "首页",
        titleSecondPage: "第二页",
        // AI Chat
        aiAssistant: "AI 助手",
        startConversation: "开始对话",
        askAboutRepositories: "向我提问关于 GitHub 仓库的任何问题",
        configured: "已配置",
        settings: "设置",
        aiSettings: "AI 设置",
        loading: "正在加载...",
        configureAI: "需要配置 AI 设置",
        configureAIDescription: "请先配置 API Key 和模型选择",
        goToConfigure: "前往配置",
        sendMessage: "发送",
        sendShortcut: "按 Ctrl/Cmd + Enter 发送，Shift + Enter 换行",
        noMessages: "暂无消息",
        startChatting: "开始对话",
        typeYourQuestion: "请输入您的问题...",
        pleaseConfigureFirst: "请先配置 AI 设置...",
        error: "错误",
        processingError: "抱歉，处理您的请求时出错。请稍后重试。",

        // AI Settings Dialog
        aiProvider: "AI 提供商",
        openaiDescription: "使用 OpenAI 的 GPT 模型",
        anthropicDescription: "使用 Anthropic 的 Claude 模型",
        deepseekDescription: "使用 DeepSeek 的模型",
        ollamaDescription: "使用本地 Ollama 模型",
        apiKey: "API Key",
        apiKeyPlaceholder: "输入您的 API Key",
        apiKeySecure: "您的 API Key 将被安全地存储在本地",
        llmModel: "LLM 模型",
        maxTokens: "Max Tokens",
        temperature: "Temperature",
        temperatureDescription: "0-2，数值越高越随机",
        advancedSettings: "高级参数",
        save: "保存",
        cancel: "取消",
        saving: "保存中...",
        settingsSaved: "设置已保存",
        validationError: "验证错误",
        pleaseEnterApiKey: "请输入 API Key",
        selectLlmModel: "请选择 LLM 模型",
        maxTokensError: "Max Tokens 必须是正整数",
        temperatureError: "Temperature 必须在 0-2 之间",
        connectionTestFailed: "连接测试失败，请检查 API Key 和设置",

        // Repository References
        references: "参考资源",
        language: "语言",
        stars: "星数",
        relevance: "相关度",
      },
    },
  },
});

export default i18n;
