/**
 * 消息内容渲染器
 * 根据 MessagePart 类型渲染对应的组件
 */

import { MessagePart } from '@shared/types';
import { ToolCallCard } from './tool-call-card';
import { TypewriterText } from './typewriter-text';

export interface MessageContentRendererProps {
  parts?: MessagePart[];
  content?: string; // 降级显示用，添加可选标记
  isStreaming?: boolean;
}

export function MessageContentRenderer({
  parts,
  content = '',  // 添加默认值
  isStreaming,
}: MessageContentRendererProps) {
  // 如果没有 parts，降级显示纯文本（使用打字机效果）
  if (!parts || parts.length === 0) {
    return (
      <TypewriterText
        content={content || ''}  // 确保不是 undefined
        isStreaming={isStreaming}
      />
    );
  }

  // 渲染结构化内容
  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        switch (part.type) {
          case 'text':
            // 只对最后一个文本部分应用打字机效果
            const isLastTextPart = index === parts.length - 1 && isStreaming;
            return (
              <TypewriterText
                key={part.id}
                content={part.content || ''}  // 确保不是 undefined
                isStreaming={isLastTextPart}
              />
            );

          case 'tool_call':
            return (
              <ToolCallCard
                key={part.id}
                toolName={part.toolName}
                args={part.args}
                status={part.status}
                result={part.result}
                error={part.error}
                startedAt={part.startedAt}
                endedAt={part.endedAt}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
