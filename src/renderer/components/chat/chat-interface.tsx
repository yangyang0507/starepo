/**
 * ChatInterface - 聊天界面容器
 * Vercel AI Chatbot 风格：默认隐藏侧边栏，居中输入框
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeft, PanelLeftClose, Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { ChatHistoryList } from "./chat-history-list";
import { ChatEmptyView } from "./chat-empty-view";
import { ChatActiveView } from "./chat-active-view";
import { useChatStore } from "@/stores/chat-store";
import { useAIAccountsStore } from "@/stores/ai-accounts-store";
import { AIModel } from "@shared/types";
import { Button } from "@/components/ui/button";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { getModelList } from "@/api/ai";

interface ChatInterfaceProps {
  conversationId: string;
}

export function ChatInterface({
  conversationId: _conversationId,
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const {
    messages,
    streamChat,
    abortCurrentStream,
    isStreaming,
    streamingMessageId,
    sessions,
    currentConversationId,
  } = useChatStore();
  const {
    accounts,
    isLoading: isLoadingAccounts,
    initAccounts,
    getAccount,
  } = useAIAccountsStore();

  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // 默认隐藏侧边栏
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  // 检查是否有已启用的 Provider
  const enabledAccount = useMemo(
    () => Array.from(accounts.values()).find((account) => account.enabled),
    [accounts],
  );

  const hasEnabledProvider = !!enabledAccount;

  // 初始化账户和模型
  useEffect(() => {
    initAccounts().catch((err) => {
      console.error("[ChatInterface] Failed to init accounts:", err);
      setError("初始化失败，请刷新页面重试");
    });
  }, [initAccounts]);

  // 当 enabledAccount 变化时，更新可用模型
  useEffect(() => {
    if (!enabledAccount) {
      setAvailableModels([]);
      setSelectedModel("");
      return;
    }

    const loadModels = async () => {
      try {
        const account = await getAccount(enabledAccount.providerId);
        if (!account) {
          return;
        }

        // 从 API 获取模型列表
        const modelListResponse = await getModelList(account, false);
        const { models } = modelListResponse;
        if (models && models.length > 0) {
          setAvailableModels(models);

          // 自动选择默认模型或第一个模型
          if (account.defaultModel) {
            setSelectedModel(account.defaultModel);
          } else {
            setSelectedModel(models[0].id);
          }
        }
      } catch (err) {
        console.error("[ChatInterface] Failed to load models:", err);
      }
    };

    loadModels();
  }, [enabledAccount, getAccount]);

  // 发送消息
  const handleSendMessage = useCallback(
    async (message: string) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage || !hasEnabledProvider) return;

      setError(null);

      try {
        await streamChat(trimmedMessage);
      } catch (err) {
        console.error("[ChatInterface] Failed to send message:", err);
        setError(
          err instanceof Error ? err.message : "发送消息失败，请稍后再试",
        );
      }
    },
    [hasEnabledProvider, streamChat],
  );

  // 快捷提示
  const handleQuickPrompt = useCallback(
    (content: string) => {
      handleSendMessage(content);
    },
    [handleSendMessage],
  );

  // 停止生成
  const handleStopGeneration = useCallback(() => {
    abortCurrentStream();
  }, [abortCurrentStream]);

  // 清除错误
  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  // 打开设置
  const handleOpenSettings = () => {
    navigate({ to: "/settings" });
  };

  // 切换侧边栏
  const toggleSidebar = () => {
    setIsHistoryOpen(!isHistoryOpen);
  };

  // 如果账户正在加载
  if (isLoadingAccounts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  // 如果没有启用的 Provider
  if (!hasEnabledProvider) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Settings className="text-primary h-8 w-8" />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-semibold">尚未配置 AI 服务</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              要开始对话，请先在设置中配置 API Key 和选择模型。
            </p>
            <Button onClick={handleOpenSettings} size="lg" className="w-full">
              前往配置
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 主界面
  return (
    <PromptInputProvider>
      <div className="bg-background flex h-full overflow-hidden">
        {/* 侧边栏 - 使用 AnimatePresence 实现动画 */}
        <AnimatePresence mode="wait">
          {isHistoryOpen && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-muted/10 flex-shrink-0 border-r overflow-hidden"
            >
              <div className="flex h-full w-[280px] flex-col">
                <ChatHistoryList />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 主内容区域 */}
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          {/* 统一的顶部标题栏 */}
          {messages.length > 0 && (
            <div className="border-border/40 bg-background/95 flex h-14 flex-shrink-0 items-center border-b px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              {/* 左侧：侧边栏切换按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 flex-shrink-0"
                aria-label={isHistoryOpen ? "隐藏历史记录" : "显示历史记录"}
              >
                {isHistoryOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
              {/* 居中：对话标题 */}
              <div className="flex-1 text-center">
                <span className="text-foreground text-sm font-medium truncate">
                  {sessions[currentConversationId]?.title || "新对话"}
                </span>
              </div>
              {/* 右侧占位，保持标题居中 */}
              <div className="w-8 flex-shrink-0" />
            </div>
          )}

          {/* 空状态时的侧边栏按钮 */}
          {messages.length === 0 && (
            <div className="absolute top-4 left-4 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
                aria-label={isHistoryOpen ? "隐藏历史记录" : "显示历史记录"}
              >
                {isHistoryOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* 视图切换 - 使用 AnimatePresence 实现平滑过渡 */}
          <div className="relative flex h-full w-full flex-col">
            <AnimatePresence mode="wait">
              {messages.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full"
                >
                  <ChatEmptyView
                    onSubmit={handleSendMessage}
                    onQuickPrompt={handleQuickPrompt}
                    disabled={!hasEnabledProvider || isStreaming}
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    onModelChange={setSelectedModel}
                    isStreaming={isStreaming}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full"
                >
                  <ChatActiveView
                    messages={messages}
                    isStreaming={isStreaming}
                    streamingMessageId={streamingMessageId}
                    error={error}
                    onSend={handleSendMessage}
                    onStop={handleStopGeneration}
                    onClearError={handleClearError}
                    disabled={!hasEnabledProvider}
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    onModelChange={setSelectedModel}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PromptInputProvider>
  );
}
