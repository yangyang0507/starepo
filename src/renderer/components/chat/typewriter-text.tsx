/**
 * 打字机效果文本组件
 * 平滑渲染流式文本，避免页面剧烈跳动
 */

import { useEffect, useState, useRef } from 'react';
import { Markdown } from '@lobehub/ui';

export interface TypewriterTextProps {
  content: string;
  isStreaming?: boolean;
  speed?: number; // 每个字符的延迟（毫秒）
  onComplete?: () => void;
}

export function TypewriterText({
  content = '',
  isStreaming = false,
  speed = 20,
  onComplete,
}: TypewriterTextProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const contentRef = useRef(content);

  // 当 content 变化时，更新引用
  useEffect(() => {
    contentRef.current = content || '';
  }, [content]);

  // 独立的打字循环
  useEffect(() => {
    // 如果不是流式状态，直接显示全部
    if (!isStreaming) {
      const safeContent = contentRef.current || '';
      setDisplayedContent(safeContent);
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      const target = contentRef.current;

      setDisplayedContent(current => {
        if (current.length < target.length) {
          // 还有内容没显示，前进一个字符
          const nextLength = current.length + 1;
          return target.slice(0, nextLength);
        } else {
          // 已追上内容
          return current;
        }
      });
    }, speed);

    return () => {
      clearInterval(interval);
    };
  }, [isStreaming, speed, onComplete]);

  return (
    <div className="relative">
      <Markdown>{displayedContent}</Markdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse" />
      )}
    </div>
  );
}