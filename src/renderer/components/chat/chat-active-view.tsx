/**
 * ChatActiveView - 活跃对话视图
 * 显示消息列表和底部输入框
 */

import { motion } from "framer-motion";
import { useState } from "react";
import { AlertCircle, Copy, RefreshCw, Check, PanelLeftClose } from "lucide-react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { ChatStatus } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
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
import { MessageContentRenderer } from "./message-content";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessage, AIModel } from "@shared/types";
import { useChatStore } from "@/stores/chat-store";

interface ChatActiveViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  onSend: (message: string) => void;
  onStop: () => void;
  onClearError: () => void;
  disabled?: boolean;
  selectedModel: string;
  availableModels: AIModel[];
  onModelChange: (modelId: string) => void;
}

export function ChatActiveView({
  messages,
  isStreaming,
  streamingMessageId,
  error,
  onSend,
  onStop,
  onClearError,
  disabled = false,
  selectedModel,
  availableModels,
  onModelChange,
}: ChatActiveViewProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleSubmit = (message: PromptInputMessage) => {
    onSend(message.text);
  };

  // 消息分组逻辑（连续相同角色的消息归为一组）
  const groupedMessages = messages.reduce<ChatMessage[][]>((groups, message) => {
    if (groups.length === 0) {
      return [[message]];
    }

    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup[lastGroup.length - 1];

    if (lastMessage.role === message.role) {
      lastGroup.push(message);
    } else {
      groups.push([message]);
    }

    return groups;
  }, []);

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const chatStatus: ChatStatus = isStreaming ? "streaming" : disabled ? "submitted" : "ready";

  return (
    <div className="flex h-full w-full flex-col">
      {/* 消息列表区域 */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex} className="message-group flex flex-col gap-4">
              {group.map((msg) => (
                <Message
                  key={msg.id}
                  from={msg.role}
                  className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    streamingMessageId === msg.id ? "is-streaming" : ""
                  }`}
                >
                  <MessageContent className={msg.role === "user" ? "shadow-sm" : ""}>
                    <MessageContentRenderer
                      parts={msg.parts}
                      content={msg.content}
                      isStreaming={isStreaming && streamingMessageId === msg.id}
                    />
                  </MessageContent>

                  <MessageToolbar className="mt-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground/60 text-[10px] font-medium tracking-wider uppercase">
                        {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <MessageActions className="origin-right scale-90">
                      <MessageAction
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        tooltip={copiedMessageId === msg.id ? "已复制" : "复制内容"}
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

          {/* 流式加载指示器 */}
          {isStreaming && !streamingMessageId && (
            <Message from="assistant" className="animate-in fade-in zoom-in-95 duration-300">
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
              onClick={onClearError}
              className="text-destructive-foreground/70 hover:text-destructive-foreground"
              aria-label="关闭错误提示"
            >
              <PanelLeftClose className="h-4 w-4 rotate-45" />
            </button>
          </div>
        </div>
      )}

      {/* 输入区域 - 使用 layoutId 实现动画过渡 */}
      <div className="bg-background/95 border-border/40 z-10 flex-shrink-0 border-t px-4 pt-4 pb-8 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-3xl">
          <motion.div layoutId="chat-input-container" className="w-full">
            <PromptInput
              onSubmit={handleSubmit}
              className="bg-background max-w-none overflow-hidden rounded-2xl border border-border/40 transition-all duration-300 focus-within:border-border/80"
            >
              <PromptInputBody className="relative">
                <PromptInputTextarea
                  placeholder="输入你的问题... (按 / 可输入命令)"
                  disabled={disabled || isStreaming}
                  className="max-h-[200px] min-h-[56px] resize-none bg-transparent px-4 py-4 text-base focus:outline-none"
                />
                <PromptInputFooter className="flex items-center justify-between bg-transparent px-4 pt-0 pb-4">
                  {/* 左侧：模型选择器 */}
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedModel}
                      onValueChange={onModelChange}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent px-2 text-sm font-medium hover:bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id} className="text-sm">
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 右侧：发送按钮 */}
                  <PromptInputSubmit
                    status={chatStatus}
                    disabled={disabled || isStreaming}
                    onClick={isStreaming ? onStop : undefined}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg p-0 transition-all disabled:opacity-50"
                  />
                </PromptInputFooter>
              </PromptInputBody>
            </PromptInput>
          </motion.div>

          {/* 底部提示文字 */}
          <p className="text-muted-foreground mt-4 mb-1 text-center text-xs">
            AI 生成的内容可能不准确，请注意核实信息
          </p>
        </div>
      </div>
    </div>
  );
}
