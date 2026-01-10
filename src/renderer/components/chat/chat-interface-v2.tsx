/**
 * 聊天界面组件 - 使用 LobeHub UI
 * 完整的 AI 聊天界面，支持流式输出、工具调用、历史记录等
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { AlertCircle, PanelLeftClose, PanelLeft, Bot, User } from "lucide-react";
import { ChatList, ChatInputArea } from "@lobehub/ui/chat";
import type { ChatMessage as LobeChatMessage } from "@lobehub/ui/chat";
import { ChatHistoryList } from "./chat-history-list";
import { useChatStore } from "@/stores/chat-store";
import { useAIAccountsStore } from "@/stores/ai-accounts-store";
import { AIModel } from "@shared/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolCallCard } from "./tool-call-card";

interface ChatInterfaceProps {
  conversationId: string;
}

export function ChatInterfaceV2({
  conversationId: _conversationId,
}: ChatInterfaceProps) {
  const {
    messages,
    streamChat,
    abortCurrentStream,
    isStreaming,
    streamingMessageId,
  } = useChatStore();

  const {
    accounts,
    isLoading: isLoadingAccounts,
    initAccounts,
    getAccount,
  } = useAIAccountsStore();

  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [inputValue, setInputValue] = useState("");

  // 检查是否有已启用的 Provider
  const enabledAccount = useMemo(
    () => Array.from(accounts.values()).find((account) => account.enabled),
    [accounts],
  );
  const hasEnabledProvider = !!enabledAccount;

  // 加载当前 Provider 的模型列表
  useEffect(() => {
    const loadModels = async () => {
      if (!enabledAccount) return;

      try {
        const account = getAccount(enabledAccount.id);
        if (account?.models) {
          setAvailableModels(account.models);
          if (account.models.length > 0 && !selectedModel) {
            setSelectedModel(account.models[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load models:", err);
      }
    };

    loadModels();
  }, [enabledAccount, getAccount, selectedModel]);

  // 初始化账户
  useEffect(() => {
    initAccounts();
  }, [initAccounts]);

  // 处理发送消息
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isStreaming) return;

      setError(null);
      setInputValue(""); // 清空输入框

      try {
        await streamChat(message);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "发送消息失败";
        setError(errorMessage);
        console.error("Failed to send message:", err);
      }
    },
    [streamChat, isStreaming],
  );

  // 处理停止生成
  const handleStopGeneration = useCallback(() => {
    abortCurrentStream();
  }, [abortCurrentStream]);

  // 转换消息为 LobeHub ChatMessage 格式
  const chatMessages: LobeChatMessage[] = useMemo(() => {
    return messages.map((msg) => {
      const isUser = msg.role === "user";

      // 构建消息内容
      let content = msg.content;

      // 如果有 parts，提取文本内容
      if (msg.parts && msg.parts.length > 0) {
        const textParts = msg.parts
          .filter((part) => part.type === "text")
          .map((part: any) => part.content)
          .join("\n");
        if (textParts) {
          content = textParts;
        }
      }

      // 构建工具调用额外内容
      const toolCalls = msg.parts
        ?.filter((part) => part.type === "tool_call")
        .map((part) => {
          const toolPart = part as any;
          return (
            <ToolCallCard
              key={part.id}
              toolName={toolPart.toolName}
              args={toolPart.args}
              status={toolPart.status}
              result={toolPart.result}
              error={toolPart.error}
              startedAt={toolPart.startedAt}
              endedAt={toolPart.endedAt}
            />
          );
        });

      return {
        id: msg.id,
        content,
        role: isUser ? "user" : "assistant",
        createAt: msg.timestamp,
        updateAt: msg.timestamp,
        error: msg.error ? { message: msg.error, type: "error" as const } : undefined,
        extra: toolCalls && toolCalls.length > 0 ? <div className="space-y-2">{toolCalls}</div> : undefined,
        meta: {
          avatar: isUser ? <User className="h-6 w-6" /> : <Bot className="h-6 w-6" />,
          title: isUser ? "你" : "AI 助手",
        },
      };
    });
  }, [messages]);

  return (
    <div className="flex h-full w-full">
      {/* 左侧历史记录 */}
      {isHistoryOpen && (
        <div className="w-64 border-r bg-background">
          <ChatHistoryList />
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex flex-1 flex-col">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              aria-label={isHistoryOpen ? "隐藏历史" : "显示历史"}
            >
              {isHistoryOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <h2 className="text-lg font-semibold">AI 助手</h2>
          </div>

          {/* 模型选择器 */}
          {hasEnabledProvider && availableModels.length > 0 && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.displayName || model.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 未配置提示 */}
        {!hasEnabledProvider && !isLoadingAccounts && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">未配置 AI Provider</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                请先在设置中配置并启用一个 AI Provider
              </p>
            </div>
          </div>
        )}

        {/* 聊天列表 */}
        {hasEnabledProvider && (
          <div className="flex-1 overflow-hidden">
            <ChatList
              data={chatMessages}
              loadingId={isStreaming ? streamingMessageId || undefined : undefined}
              showTitle
              variant="bubble"
            />
          </div>
        )}

        {/* 输入框 */}
        {hasEnabledProvider && (
          <div className="border-t p-4">
            <ChatInputArea
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onStop={handleStopGeneration}
              loading={isStreaming}
              placeholder="输入你的问题...（按 / 可输入命令）"
            />
          </div>
        )}
      </div>
    </div>
  );
}
