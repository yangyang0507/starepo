import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, MessagesSquare, Copy, RefreshCw, PanelLeft, PanelLeftClose } from 'lucide-react';
import { ChatHistoryList } from './chat-history-list';
import { useChatStore } from '@/stores/chat-store';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { ChatMessage } from '@shared/types';
import { Button } from '@/components/ui/button';
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

export function ChatInterface({ conversationId: _conversationId }: ChatInterfaceProps) {
  const { messages, addMessage } = useChatStore();
  const { accounts, isLoading: isLoadingAccounts, initAccounts } = useAIAccountsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // 初始化账户
  useEffect(() => {
    initAccounts();
  }, [initAccounts]);

  // 检查是否有已启用的 Provider
  const hasEnabledProvider = Array.from(accounts.values()).some((account) => account.enabled);

  // 处理发送消息
  const handleSendMessage = useCallback(
    async ({ text }: { text: string }) => {
      if (!text.trim() || !hasEnabledProvider || isLoading) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      addMessage(userMessage);
      setIsLoading(true);
      setError(null);

      try {
        // TODO: 调用 AI API
        // 临时模拟响应
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '这是一个临时的模拟响应。AI 功能正在开发中...',
          timestamp: Date.now(),
        };

        addMessage(assistantMessage);
      } catch (err) {
        setError(err instanceof Error ? err.message : '发送消息失败');
      } finally {
        setIsLoading(false);
      }
    },
    [hasEnabledProvider, isLoading, addMessage]
  );

  // 处理复制消息
  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // 处理重试消息
  const handleRetryMessage = useCallback(
    (content: string) => {
      handleSendMessage({ text: content });
    },
    [handleSendMessage]
  );

  // 打开设置页面
  const handleOpenSettings = useCallback(() => {
    // TODO: 导航到设置页面
    console.log('Open settings');
  }, []);

  // 获取聊天状态
  const chatStatus = isLoading ? 'streaming' : undefined;

  // 未配置或初始化中
  if (!hasEnabledProvider || isLoadingAccounts) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          {isLoadingAccounts ? (
            <>
              <Loader size={32} className="mb-4 mx-auto" />
              <p className="text-muted-foreground">正在加载设置...</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">需要配置 AI 设置</h2>
              <p className="text-muted-foreground mb-4">
                请先配置 API Key 和模型选择
              </p>
              <Button onClick={handleOpenSettings}>前往配置</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 聊天界面
  return (
    <div className="flex h-full overflow-hidden">
      {/* 侧边栏 */}
      <div
        className={`flex-shrink-0 border-r bg-muted/20 transition-all duration-300 ease-in-out ${isHistoryOpen ? 'w-64' : 'w-0 opacity-0 overflow-hidden'}`}
      >
        <div className="w-64 h-full">
          <ChatHistoryList />
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="flex h-full flex-col flex-1 min-w-0">
        {/* 工具栏 */}
        <div className="flex items-center h-12 px-3 border-b bg-background/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            title={isHistoryOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            {isHistoryOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 消息列表区域 */}
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="h-full">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessagesSquare className="w-16 h-16" />}
                title="开始对话"
                description="提问关于 GitHub 仓库的任何问题"
              />
            ) : (
              <>
                {messages.map((msg) => (
                  <Message key={msg.id} from={msg.role}>
                    <MessageContent>
                      {msg.role === 'user' ? (
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <MessageResponse>{msg.content}</MessageResponse>
                      )}
                    </MessageContent>

                    <MessageToolbar>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>

                      <MessageActions>
                        <MessageAction
                          onClick={() => handleCopyMessage(msg.content)}
                          tooltip="复制"
                          label="复制消息"
                        >
                          <Copy className="w-4 h-4" />
                        </MessageAction>

                        {msg.role === 'user' && (
                          <MessageAction
                            onClick={() => handleRetryMessage(msg.content)}
                            tooltip="重试"
                            label="重新发送"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </MessageAction>
                        )}
                      </MessageActions>
                    </MessageToolbar>
                  </Message>
                ))}

                {isLoading && (
                  <Message from="assistant">
                    <MessageContent>
                      <div className="flex items-center gap-2">
                        <Loader size={16} />
                        <span className="text-sm text-muted-foreground">思考中...</span>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* 错误提示 */}
        {error && (
          <div className="flex-shrink-0 px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive">
            <p className="text-sm font-medium">错误: {error}</p>
          </div>
        )}

        {/* 输入区域 */}
        <div className="flex-shrink-0 border-t bg-background p-4">
          <PromptInput onSubmit={handleSendMessage} className="max-w-none">
            <PromptInputBody>
              <PromptInputTextarea
                placeholder="提问关于 GitHub 仓库的任何问题..."
                disabled={!hasEnabledProvider || isLoading}
                className="!min-h-20"
              />
              <PromptInputFooter>
                <div className="flex-1 text-xs text-muted-foreground">
                  {isLoading ? '正在处理...' : 'Enter 发送 · Shift+Enter 换行'}
                </div>
                <PromptInputSubmit status={chatStatus} disabled={!hasEnabledProvider} />
              </PromptInputFooter>
            </PromptInputBody>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
