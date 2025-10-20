/**
 * 聊天界面主组件
 * 集成消息列表、输入区域和 AI 设置
 */

import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chat-store';
import MessageList from './message-list';
import InputArea from './input-area';
import { AISafeSettings } from '@shared/types';
import { useAIApi } from '@/api/ai';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';

interface ChatInterfaceProps {
  conversationId?: string;
}

export default function ChatInterface({ conversationId = 'default' }: ChatInterfaceProps) {
  const { messages, addMessage } = useChatStore();
  const { sendMessage, getAISettings, isLoading, error } = useAIApi();
  const router = useRouter();

  const [aiSettings, setAISettings] = useState<AISafeSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 初始化：获取 AI 设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsInitializing(true);
        const settings = await getAISettings();
        setAISettings(settings);
      } catch (err) {
        console.error('Failed to load AI settings:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    loadSettings();
  }, [getAISettings]);

  // 处理发送消息
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // 添加用户消息到本地
    addMessage({
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    });

    try {
      // 调用 AI API
      const response = await sendMessage(content, conversationId);

      // 添加 AI 响应
      addMessage({
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        references: response.references,
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      // 添加错误消息
      addMessage({
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `抱歉，处理您的请求时出错。请稍后重试。`,
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : '未知错误',
      });
    }
  };

  const handleOpenSettings = React.useCallback(() => {
    router.navigate({ to: '/settings', hash: 'ai-settings' });
  }, [router]);

  // 检查是否已配置 AI
  const isConfigured = aiSettings?.configured ?? false;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex-1 overflow-hidden">
        {!isConfigured || isInitializing ? (
          // 未配置或初始化中
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {isInitializing ? (
                <>
                  <div className="animate-spin mb-4">⏳</div>
                  <p className="text-gray-600 dark:text-gray-400">正在加载设置...</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold mb-2">需要配置 AI 设置</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    请先配置 API Key 和模型选择
                  </p>
                  <Button onClick={handleOpenSettings}>
                    前往配置
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          // 聊天界面
          <div className="flex flex-col h-full">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p className="text-lg mb-2">开始对话</p>
                    <p className="text-sm">提问关于 GitHub 仓库的任何问题</p>
                  </div>
                </div>
              ) : (
                <MessageList messages={messages} />
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md mx-4 mb-4">
                <p className="text-sm font-medium">错误: {error}</p>
              </div>
            )}

            {/* 输入区域 */}
            <div className="border-t p-4">
              <InputArea
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                disabled={!isConfigured}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
