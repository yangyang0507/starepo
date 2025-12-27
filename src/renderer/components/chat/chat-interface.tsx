import { useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, MessagesSquare, Copy, RefreshCw, PanelLeftClose, PanelLeft, Check } from 'lucide-react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ChatHistoryList } from './chat-history-list';
import { useChatStore } from '@/stores/chat-store';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { useAIApi } from '@/api/ai';
import { ChatMessage, AIModel } from '@shared/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolbar,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Loader } from '@/components/ai-elements/loader';

interface ChatInterfaceProps {
  conversationId: string;
}

// 快捷提示
const QUICK_PROMPTS = [
  { id: '1', title: '分析当前代码', content: '帮我分析当前的代码结构' },
  { id: '2', title: '查找 Bug', content: '帮我查找代码中的潜在问题' },
  { id: '3', title: '优化性能', content: '帮我优化代码性能' },
];

const INITIAL_DISPLAY_COUNT = 20;
const LOAD_MORE_COUNT = 10;

export function ChatInterface({ conversationId: _conversationId }: ChatInterfaceProps) {
  const { messages, streamChat, abortCurrentStream, isStreaming, streamingMessageId, processQueue, isProcessingQueue } = useChatStore();
  const { accounts, isLoading: isLoadingAccounts, initAccounts, getAccount } = useAIAccountsStore();
  const { getAISettings, updateAISettings } = useAIApi();

  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [hasMore, setHasMore] = useState(false);

  // 检查是否有已启用的 Provider
  const enabledAccount = useMemo(() =>
    Array.from(accounts.values()).find((account) => account.enabled),
    [accounts]
  );
  const hasEnabledProvider = !!enabledAccount;

  // 初始化和同步设置
  useEffect(() => {
    const syncSettings = async () => {
      try {
        const settings = await getAISettings();
        if (settings?.model) {
          setSelectedModel(settings.model);
        }
      } catch (err) {
        console.error('[ChatInterface] Failed to fetch AI settings:', err);
      }
    };
    void syncSettings();
  }, [getAISettings]);

  // 加载当前 Provider 的模型列表
  useEffect(() => {
    const loadModels = async () => {
      if (!enabledAccount) return;

      try {
        const { getModelList } = await import('@/api/ai');
        const accountConfig = await getAccount(enabledAccount.providerId);
        if (accountConfig) {
          const response = await getModelList(accountConfig);
          setAvailableModels(response.models);

          // 如果没有选中模型且有可用模型，默认选第一个
          if (!selectedModel && response.models.length > 0) {
            const firstModel = response.models[0].id;
            setSelectedModel(firstModel);
            // 同步到全局设置
            void updateAISettings({ model: firstModel });
          }
        }
      } catch (err) {
        console.error('[ChatInterface] Failed to load models:', err);
      }
    };
    void loadModels();
  }, [enabledAccount, getAccount, updateAISettings, selectedModel]);

  // 处理模型变更
  const handleModelChange = useCallback(async (modelId: string) => {
    setSelectedModel(modelId);
    try {
      await updateAISettings({ model: modelId });
    } catch (err) {
      console.error('[ChatInterface] Failed to update model setting:', err);
      setError('更新模型设置失败');
    }
  }, [updateAISettings]);

  // 消息分组逻辑：按对话轮次分组（用户消息 + 助手回复）
  const groupedMessages = useMemo(() => {
    const groups: ChatMessage[][] = [];
    let currentGroup: ChatMessage[] = [];

    messages.forEach((msg) => {
      if (msg.role === 'user') {
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

      if (msg.role === 'user') {
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
    setDisplayCount(prev => Math.min(prev + LOAD_MORE_COUNT, messages.length));
  }, [messages.length]);

  // 初始化账户
  useEffect(() => {
    console.log('[ChatInterface] Initializing accounts...');
    initAccounts();
  }, [initAccounts]);

  // 监控账户状态变化
  useEffect(() => {
    console.log('[ChatInterface] Accounts state:', {
      accounts: Array.from(accounts.entries()),
      hasEnabledProvider,
      isLoadingAccounts
    });
  }, [accounts, hasEnabledProvider, isLoadingAccounts]);

  console.log('[ChatInterface] Render state:', { hasEnabledProvider, isLoadingAccounts, isStreaming });

  // 处理发送消息 - 使用流式 API
  const handleSendMessage = useCallback(
    async ({ text }: { text: string }) => {
      console.log('[ChatInterface] handleSendMessage called:', { text, hasEnabledProvider, isStreaming });

      if (!text.trim() || !hasEnabledProvider || isStreaming) {
        console.log('[ChatInterface] Message skipped:', { textEmpty: !text.trim(), noProvider: !hasEnabledProvider, isStreaming });
        return;
      }

      setError(null);

      try {
        console.log('[ChatInterface] Calling streamChat...');
        await streamChat(text, {
          onComplete: (data) => {
            console.log('[ChatInterface] Chat complete:', data);
          },
          onError: (error) => {
            console.error('[ChatInterface] Chat error:', error);
            setError(error);
          },
        });
      } catch (err) {
        console.error('[ChatInterface] Send message error:', err);
        setError(err instanceof Error ? err.message : '发送消息失败');
      }
    },
    [hasEnabledProvider, isStreaming, streamChat]
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
  const handleQuickPrompt = useCallback((content: string) => {
    handleSendMessage({ text: content });
  }, [handleSendMessage]);

  // 打开设置页面
  const handleOpenSettings = useCallback(() => {
    // TODO: 导航到设置页面
    console.log('Open settings');
  }, []);

  // 获取聊天状态
  const chatStatus = isStreaming ? 'streaming' : undefined;

  // 未配置或初始化中
  if (!hasEnabledProvider || isLoadingAccounts) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm">
          {isLoadingAccounts ? (
            <div className="flex flex-col items-center">
              <Loader size={32} className="mb-4 text-primary" />
              <p className="text-muted-foreground animate-pulse">正在加载设置...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">需要配置 AI 设置</h2>
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
    <div className="flex h-full overflow-hidden bg-background">
      {/* 侧边栏 */}
      <div
        className={`flex-shrink-0 border-r bg-muted/10 transition-all duration-300 ease-in-out ${isHistoryOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0 border-r-0 overflow-hidden'}`}
      >
        <div className="w-[280px] h-full flex flex-col">
          <ChatHistoryList />
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="flex h-full flex-col flex-1 min-w-0 relative bg-background/50 isolate">
        {/* 精致的背景纹理 */}
        <div className="absolute inset-0 z-[-1] opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between h-14 px-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10 transition-shadow hover:shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              title={isHistoryOpen ? "收起侧边栏" : "展开侧边栏"}
            >
              {isHistoryOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <div className="h-4 w-[1px] bg-border mx-1" />
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors cursor-pointer border-none bg-transparent">
                <SelectValue placeholder="选择模型" className="text-sm font-medium" />
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
        <Conversation className="flex-1 min-h-0" id="messages">
          <ConversationContent className="h-full max-w-4xl mx-auto px-4 py-6 w-full gap-6 flex flex-col-reverse">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={
                  <div className="w-20 h-20 bg-primary/5 rounded-2xl flex items-center justify-center mb-4">
                    <MessagesSquare className="w-10 h-10 text-primary" />
                  </div>
                }
                title="开启新的对话"
                description="我可以帮助你分析 GitHub 仓库代码，解答技术问题。"
              >
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handleQuickPrompt(prompt.content)}
                      className="p-4 text-left rounded-lg border border-border/50 bg-card/30 hover:bg-accent hover:border-accent transition-all"
                    >
                      <div className="font-medium text-sm mb-1">{prompt.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{prompt.content}</div>
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
                style={{ display: 'flex', flexDirection: 'column-reverse', gap: '2rem' }}
              >
                {displayGroupedMessages.map((group, groupIndex) => (
                  <div key={groupIndex} className="message-group flex flex-col gap-3">
                    {group.map((msg) => (
                      <Message
                        key={msg.id}
                        from={msg.role}
                        className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${streamingMessageId === msg.id ? 'is-streaming' : ''
                          }`}
                      >
                        <MessageContent className={msg.role === 'user' ? 'shadow-sm' : ''}>
                          {msg.role === 'user' ? (
                            <div className="text-base whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          ) : (
                            <MessageResponse>{msg.content}</MessageResponse>
                          )}
                        </MessageContent>

                        <MessageToolbar className="mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground/60 uppercase font-medium tracking-wider">
                              {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <MessageActions className="scale-90 origin-right">
                            <MessageAction
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              tooltip={copiedMessageId === msg.id ? '已复制' : '复制内容'}
                              label="复制"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </MessageAction>

                            {msg.role === 'assistant' && (
                              <MessageAction
                                onClick={() => {
                                  const state = useChatStore.getState();
                                  state.regenerateLastResponse();
                                }}
                                tooltip="重新生成"
                                label="重新生成"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </MessageAction>
                            )}
                          </MessageActions>
                        </MessageToolbar>
                      </Message>
                    ))}
                  </div>
                ))}

                {isStreaming && !streamingMessageId && (
                  <Message from="assistant" className="animate-in fade-in zoom-in-95 duration-300">
                    <MessageContent>
                      <div className="flex items-center gap-3 py-1">
                        <Loader size={18} className="text-primary" />
                        <span className="text-sm text-foreground/80 font-medium animate-pulse">正在思考中...</span>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </InfiniteScroll>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bg-background/80 backdrop-blur shadow-md hover:bg-background hover:shadow-lg transition-all" />
        </Conversation>

        {/* 错误提示 */}
        {error && (
          <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-20 animate-in slide-in-from-bottom-5 fade-in">
            <div className="bg-destructive/95 backdrop-blur text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center justify-between border border-destructive/50">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="text-destructive-foreground/70 hover:text-destructive-foreground"
                aria-label="关闭错误提示"
              >
                <PanelLeftClose className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="flex-shrink-0 px-4 pb-6 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10 w-full max-w-4xl mx-auto">
          <PromptInput onSubmit={handleSendMessage} className="max-w-none shadow-lg border rounded-xl overflow-hidden bg-background ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
            <PromptInputBody className="relative bg-background">
              <PromptInputTextarea
                placeholder="输入你的问题... (按 / 可输入命令)"
                disabled={!hasEnabledProvider || isStreaming}
                className="min-h-[60px] max-h-[200px] py-4 px-4 text-base resize-none focus:outline-none bg-transparent"
              />
              <PromptInputFooter className="px-3 pb-3 pt-0 bg-transparent flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 font-medium">
                  <span className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                    <span className="text-[10px]">↵</span> 发送
                  </span>
                  <span className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                    <span className="text-[10px]">⇧ ↵</span> 换行
                  </span>
                </div>
                <PromptInputSubmit
                  status={chatStatus}
                  disabled={!hasEnabledProvider || isStreaming}
                  onClick={isStreaming ? handleStopGeneration : undefined}
                  className="rounded-lg h-9 w-9 p-0 flex items-center justify-center transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                />
              </PromptInputFooter>
            </PromptInputBody>
          </PromptInput>
          <div className="text-center mt-2">
            <p className="text-[10px] text-muted-foreground/40">AI 生成的内容可能不完全准确，请核实重要信息。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
