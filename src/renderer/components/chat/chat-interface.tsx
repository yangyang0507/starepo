import { useState, useCallback, useEffect, useMemo } from "react";
import {
  AlertCircle,
  MessagesSquare,
  Copy,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  Check,
} from "lucide-react";
import InfiniteScroll from "react-infinite-scroll-component";
import { ChatHistoryList } from "./chat-history-list";
import { useChatStore } from "@/stores/chat-store";
import { useAIAccountsStore } from "@/stores/ai-accounts-store";
import { useAIApi } from "@/api/ai";
import { ChatMessage, AIModel } from "@shared/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Loader } from "@/components/ai-elements/loader";

interface ChatInterfaceProps {
  conversationId: string;
}

// 快捷提示
const QUICK_PROMPTS = [
  { id: "1", title: "分析当前代码", content: "帮我分析当前的代码结构" },
  { id: "2", title: "查找 Bug", content: "帮我查找代码中的潜在问题" },
  { id: "3", title: "优化性能", content: "帮我优化代码性能" },
];

const INITIAL_DISPLAY_COUNT = 20;
const LOAD_MORE_COUNT = 10;

export function ChatInterface({
  conversationId: _conversationId,
}: ChatInterfaceProps) {
  const {
    messages,
    streamChat,
    abortCurrentStream,
    isStreaming,
    streamingMessageId,
    processQueue,
    isProcessingQueue,
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [hasMore, setHasMore] = useState(false);

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
        const { getModelList } = await import("@/api/ai");
        const accountConfig = await getAccount(enabledAccount.providerId);
        if (accountConfig) {
          const response = await getModelList(accountConfig);
          setAvailableModels(response.models);

          if (!selectedModel && response.models.length > 0) {
            const firstModel = response.models[0].id;
            setSelectedModel(firstModel);
          }
        }
      } catch (err) {
        console.error("[ChatInterface] Failed to load models:", err);
      }
    };
    void loadModels();
  }, [enabledAccount, getAccount, selectedModel]);

  // 处理模型变更
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  // 消息分组逻辑：按对话轮次分组（用户消息 + 助手回复）
  const groupedMessages = useMemo(() => {
    const groups: ChatMessage[][] = [];
    let currentGroup: ChatMessage[] = [];

    messages.forEach((msg) => {
      if (msg.role === "user") {
        // 遇到用户消息，保存当前组并开始新组
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [msg];
      } else {
        // 助手消息添加到当前组
        currentGroup.push(msg);
      }
    });

    // 保存最后一组
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }, [messages]);

  // 计算要显示的消息（倒序）
  const displayMessages = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.slice(0, displayCount);
  }, [messages, displayCount]);

  // 对显示的消息进行分组
  const displayGroupedMessages = useMemo(() => {
    if (!displayMessages || displayMessages.length === 0) {
      return [];
    }

    const groups: ChatMessage[][] = [];
    let currentGroup: ChatMessage[] = [];

    // displayMessages 是倒序的，需要正序处理
    const orderedMessages = [...displayMessages].reverse();

    orderedMessages.forEach((msg) => {
      if (!msg) return; // 跳过无效消息

      if (msg.role === "user") {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // 倒序返回分组，以便最新的组在前面
    return groups.reverse();
  }, [displayMessages]);

  // 更新 hasMore 状态
  useEffect(() => {
    setHasMore(displayCount < messages.length);
  }, [displayCount, messages.length]);

  // 加载更多消息
  const loadMoreMessages = useCallback(() => {
    setDisplayCount((prev) =>
      Math.min(prev + LOAD_MORE_COUNT, messages.length),
    );
  }, [messages.length]);

  // 初始化账户
  useEffect(() => {
    console.log("[ChatInterface] Initializing accounts...");
    initAccounts();
  }, [initAccounts]);

  // 监控账户状态变化
  useEffect(() => {
    console.log("[ChatInterface] Accounts state:", {
      accounts: Array.from(accounts.entries()),
      hasEnabledProvider,
      isLoadingAccounts,
    });
  }, [accounts, hasEnabledProvider, isLoadingAccounts]);

  console.log("[ChatInterface] Render state:", {
    hasEnabledProvider,
    isLoadingAccounts,
    isStreaming,
  });

  // 处理发送消息 - 使用流式 API
  const handleSendMessage = useCallback(
    async ({ text }: { text: string }) => {
      console.log("[ChatInterface] handleSendMessage called:", {
        text,
        hasEnabledProvider,
        isStreaming,
      });

      if (!text.trim() || !hasEnabledProvider || isStreaming) {
        console.log("[ChatInterface] Message skipped:", {
          textEmpty: !text.trim(),
          noProvider: !hasEnabledProvider,
          isStreaming,
        });
        return;
      }

      setError(null);

      try {
        console.log("[ChatInterface] Calling streamChat...");
        await streamChat(text, {
          onComplete: (data) => {
            console.log("[ChatInterface] Chat complete:", data);
          },
          onError: (error) => {
            console.error("[ChatInterface] Chat error:", error);
            setError(error);
          },
        });
      } catch (err) {
        console.error("[ChatInterface] Send message error:", err);
        setError(err instanceof Error ? err.message : "发送消息失败");
      }
    },
    [hasEnabledProvider, isStreaming, streamChat],
  );

  // 停止生成
  const handleStopGeneration = useCallback(() => {
    abortCurrentStream();
  }, [abortCurrentStream]);

  // 处理复制消息
  const handleCopyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    });
  }, []);

  // 处理快速提示点击
  const handleQuickPrompt = useCallback(
    (content: string) => {
      handleSendMessage({ text: content });
    },
    [handleSendMessage],
  );

  // 打开设置页面
  const handleOpenSettings = useCallback(() => {
    // TODO: 导航到设置页面
    console.log("Open settings");
  }, []);

  // 获取聊天状态
  const chatStatus = isStreaming ? "streaming" : undefined;

  // 未配置或初始化中
  if (!hasEnabledProvider || isLoadingAccounts) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="bg-card/50 max-w-md rounded-xl border p-8 text-center shadow-sm backdrop-blur-sm">
          {isLoadingAccounts ? (
            <div className="flex flex-col items-center">
              <Loader size={32} className="text-primary mb-4" />
              <p className="text-muted-foreground animate-pulse">
                正在加载设置...
              </p>
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">需要配置 AI 设置</h2>
              <p className="text-muted-foreground mb-6">
                要开始对话，请先在设置中配置 API Key 和选择模型。
              </p>
              <Button onClick={handleOpenSettings} size="lg" className="w-full">
                前往配置
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 聊天界面
  return (
    <div className="bg-background flex h-full overflow-hidden">
      {/* 侧边栏 */}
      <div
        className={`bg-muted/10 flex-shrink-0 border-r transition-all duration-300 ease-in-out ${isHistoryOpen ? "w-[280px] opacity-100" : "w-0 overflow-hidden border-r-0 opacity-0"}`}
      >
        <div className="flex h-full w-[280px] flex-col">
          <ChatHistoryList />
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="bg-background/50 relative isolate flex h-full min-w-0 flex-1 flex-col">
        {/* 精致的背景纹理 */}
        <div
          className="absolute inset-0 z-[-1] opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* 顶部工具栏 */}
        <div className="bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md transition-shadow hover:shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-9 w-9"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              title={isHistoryOpen ? "收起侧边栏" : "展开侧边栏"}
            >
              {isHistoryOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <div className="bg-border mx-1 h-4 w-[1px]" />
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="hover:bg-muted/50 h-8 cursor-pointer rounded-md border-none bg-transparent px-2 py-1 transition-colors">
                <SelectValue
                  placeholder="选择模型"
                  className="text-sm font-medium"
                />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName || m.id}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    暂无可用模型
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 消息列表区域 */}
        <Conversation className="min-h-0 flex-1" id="messages">
          <ConversationContent className="mx-auto flex h-full w-full max-w-4xl flex-col-reverse gap-6 px-4 py-6">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={
                  <div className="bg-primary/5 mb-4 flex h-20 w-20 items-center justify-center rounded-2xl">
                    <MessagesSquare className="text-primary h-10 w-10" />
                  </div>
                }
                title="开启新的对话"
                description="我可以帮助你分析 GitHub 仓库代码，解答技术问题。"
              >
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handleQuickPrompt(prompt.content)}
                      className="border-border/50 bg-card/30 hover:bg-accent hover:border-accent rounded-lg border p-4 text-left transition-all"
                    >
                      <div className="mb-1 text-sm font-medium">
                        {prompt.title}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {prompt.content}
                      </div>
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
            ) : (
              <InfiniteScroll
                dataLength={displayMessages.length}
                next={loadMoreMessages}
                hasMore={hasMore}
                loader={
                  <div className="flex justify-center py-4">
                    <Loader size={20} className="text-primary" />
                  </div>
                }
                inverse={true}
                scrollableTarget="messages"
                style={{
                  display: "flex",
                  flexDirection: "column-reverse",
                  gap: "2rem",
                }}
              >
                {displayGroupedMessages.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className="message-group flex flex-col gap-3"
                  >
                    {group.map((msg) => (
                      <Message
                        key={msg.id}
                        from={msg.role}
                        className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                          streamingMessageId === msg.id ? "is-streaming" : ""
                        }`}
                      >
                        <MessageContent
                          className={msg.role === "user" ? "shadow-sm" : ""}
                        >
                          {msg.role === "user" ? (
                            <div className="text-base leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          ) : (
                            <MessageResponse>{msg.content}</MessageResponse>
                          )}
                        </MessageContent>

                        <MessageToolbar className="mt-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground/60 text-[10px] font-medium tracking-wider uppercase">
                              {new Date(msg.timestamp).toLocaleTimeString(
                                "zh-CN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>

                          <MessageActions className="origin-right scale-90">
                            <MessageAction
                              onClick={() =>
                                handleCopyMessage(msg.id, msg.content)
                              }
                              tooltip={
                                copiedMessageId === msg.id
                                  ? "已复制"
                                  : "复制内容"
                              }
                              label="复制"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </MessageAction>

                            {msg.role === "assistant" && (
                              <MessageAction
                                onClick={() => {
                                  const state = useChatStore.getState();
                                  state.regenerateLastResponse();
                                }}
                                tooltip="重新生成"
                                label="重新生成"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </MessageAction>
                            )}
                          </MessageActions>
                        </MessageToolbar>
                      </Message>
                    ))}
                  </div>
                ))}

                {isStreaming && !streamingMessageId && (
                  <Message
                    from="assistant"
                    className="animate-in fade-in zoom-in-95 duration-300"
                  >
                    <MessageContent>
                      <div className="flex items-center gap-3 py-1">
                        <Loader size={18} className="text-primary" />
                        <span className="text-foreground/80 animate-pulse text-sm font-medium">
                          正在思考中...
                        </span>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </InfiniteScroll>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bg-background/80 hover:bg-background shadow-md backdrop-blur transition-all hover:shadow-lg" />
        </Conversation>

        {/* 错误提示 */}
        {error && (
          <div className="animate-in slide-in-from-bottom-5 fade-in absolute bottom-[100px] left-1/2 z-20 w-full max-w-lg -translate-x-1/2 px-4">
            <div className="bg-destructive/95 text-destructive-foreground border-destructive/50 flex items-center justify-between rounded-lg border px-4 py-3 shadow-lg backdrop-blur">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="text-destructive-foreground/70 hover:text-destructive-foreground"
                aria-label="关闭错误提示"
              >
                <PanelLeftClose className="h-4 w-4 rotate-45" />
              </button>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="from-background via-background z-10 mx-auto w-full max-w-4xl flex-shrink-0 bg-gradient-to-t to-transparent px-4 pt-2 pb-6">
          <PromptInput
            onSubmit={handleSendMessage}
            className="bg-background ring-border/50 focus-within:ring-primary/20 max-w-none overflow-hidden rounded-xl border shadow-lg ring-1 transition-all duration-300 focus-within:ring-2"
          >
            <PromptInputBody className="bg-background relative">
              <PromptInputTextarea
                placeholder="输入你的问题... (按 / 可输入命令)"
                disabled={!hasEnabledProvider || isStreaming}
                className="max-h-[200px] min-h-[60px] resize-none bg-transparent px-4 py-4 text-base focus:outline-none"
              />
              <PromptInputFooter className="flex items-center justify-between bg-transparent px-3 pt-0 pb-3">
                <div className="text-muted-foreground/60 flex items-center gap-2 text-xs font-medium">
                  <span className="bg-muted/50 border-border/50 flex items-center gap-1 rounded border px-1.5 py-0.5">
                    <span className="text-[10px]">↵</span> 发送
                  </span>
                  <span className="bg-muted/50 border-border/50 flex items-center gap-1 rounded border px-1.5 py-0.5">
                    <span className="text-[10px]">⇧ ↵</span> 换行
                  </span>
                </div>
                <PromptInputSubmit
                  status={chatStatus}
                  disabled={!hasEnabledProvider || isStreaming}
                  onClick={isStreaming ? handleStopGeneration : undefined}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg p-0 shadow-sm transition-all disabled:opacity-50"
                />
              </PromptInputFooter>
            </PromptInputBody>
          </PromptInput>
          <div className="mt-2 text-center">
            <p className="text-muted-foreground/40 text-[10px]">
              AI 生成的内容可能不完全准确，请核实重要信息。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
