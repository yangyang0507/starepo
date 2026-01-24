/**
 * ChatEmptyView - 空状态视图
 * Vercel AI Chatbot 风格的居中欢迎界面
 */

import { motion } from "framer-motion";
import { MessagesSquare, Search, TrendingUp, Lightbulb, FolderHeart } from "lucide-react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIModel } from "@shared/types";

// 快捷提示数据
const QUICK_PROMPTS = [
  {
    id: "1",
    title: "搜索仓库",
    content: "帮我找一些关于 React 状态管理的开源项目",
    icon: Search,
  },
  {
    id: "2",
    title: "发现趋势",
    content: "最近有哪些热门的 AI 相关开源项目？",
    icon: TrendingUp,
  },
  {
    id: "3",
    title: "项目推荐",
    content: "根据我的 Star 记录，推荐一些我可能感兴趣的项目",
    icon: Lightbulb,
  },
  {
    id: "4",
    title: "整理收藏",
    content: "帮我整理和分类我收藏的仓库",
    icon: FolderHeart,
  },
];

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

interface ChatEmptyViewProps {
  onSubmit: (message: string) => void;
  onQuickPrompt: (prompt: string) => void;
  disabled?: boolean;
  selectedModel: string;
  availableModels: AIModel[];
  onModelChange: (modelId: string) => void;
  isStreaming?: boolean;
}

export function ChatEmptyView({
  onSubmit,
  onQuickPrompt,
  disabled = false,
  selectedModel,
  availableModels,
  onModelChange,
  isStreaming = false,
}: ChatEmptyViewProps) {
  const handleCardClick = (content: string) => {
    onQuickPrompt(content);
  };

  const handleSubmit = (message: PromptInputMessage) => {
    onSubmit(message.text);
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 pb-12 pt-8">
      <div className="w-full max-w-3xl space-y-8">
        {/* 欢迎标题 */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ring-8 ring-primary/5"
          >
            <MessagesSquare className="text-primary h-10 w-10" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-3 text-4xl font-semibold tracking-tight"
          >
            Hello there!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg"
          >
            How can I help you today?
          </motion.p>
        </div>

        {/* 输入框 - 使用 layoutId 实现动画过渡 */}
        <motion.div
          layoutId="chat-input-container"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full"
        >
          <PromptInput
            onSubmit={handleSubmit}
            className="bg-background/80 max-w-none overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl transition-all duration-300 focus-within:border-border/80"
          >
            <PromptInputBody className="relative">
              <PromptInputTextarea
                placeholder="输入你的问题... (按 / 可输入命令)"
                disabled={disabled}
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
                  disabled={disabled}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-full px-4 font-medium transition-all"
                />
              </PromptInputFooter>
            </PromptInputBody>
          </PromptInput>
        </motion.div>

        {/* 快捷提示卡片 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {QUICK_PROMPTS.map((prompt, index) => {
            const Icon = prompt.icon;
            return (
              <motion.button
                key={prompt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                onClick={() => handleCardClick(prompt.content)}
                disabled={disabled}
                className="bg-card/50 hover:bg-muted/60 disabled:hover:bg-card/50 group flex items-start gap-3 rounded-2xl border border-border/40 p-4 text-left transition-all duration-200 hover:border-border/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="bg-primary/10 group-hover:bg-primary/15 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors">
                  <Icon className="text-primary h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1 pt-1">
                  <p className="font-medium text-sm">{prompt.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {prompt.content}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* 底部提示文字 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="text-muted-foreground mt-2 text-center text-xs"
        >
          AI 生成的内容可能不准确，请注意核实信息
        </motion.p>
      </div>
    </div>
  );
}
