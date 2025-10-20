/**
 * 单条消息组件
 * 显示用户或 AI 的单条消息和相关资源
 */

import React from 'react';
import { ChatMessage, RepositoryReference } from '@shared/types';
import { AlertCircle, ExternalLink, Github } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExternalLink } from '@/hooks/use-external-link';

interface MessageItemProps {
  message: ChatMessage;
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isError = !!message.error;

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* 头像 */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0',
          isUser ? 'bg-blue-500' : 'bg-green-500'
        )}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* 消息内容 */}
      <div className={cn('flex-1 max-w-[70%]', isUser && 'text-right')}>
        {/* 消息文本 */}
        <div
          className={cn(
            'rounded-lg p-3 break-words',
            isUser
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
              : isError
                ? 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          )}
        >
          {isError && (
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">错误</span>
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* 时间戳 */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-3">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN')}
        </p>

        {/* 参考资源 */}
        {message.references && message.references.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 px-3">
              📚 参考资源:
            </p>
            <div className="space-y-2">
              {message.references.map((repo) => (
                <RepositoryCard key={repo.repositoryId} repository={repo} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 仓库卡片组件
 */
function RepositoryCard({ repository }: { repository: RepositoryReference }) {
  const { handleLinkClick } = useExternalLink();

  return (
    <button
      onClick={handleLinkClick(repository.url)}
      className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 仓库名称 */}
          <div className="flex items-center gap-1 mb-1">
            <Github className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 flex-shrink-0" />
            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {repository.owner}/{repository.repositoryName}
            </p>
          </div>

          {/* 描述 */}
          {repository.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {repository.description}
            </p>
          )}

          {/* 标签 */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {repository.language && (
              <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs rounded">
                {repository.language}
              </span>
            )}
            {repository.stars !== undefined && (
              <span className="inline-block text-xs text-gray-600 dark:text-gray-400">
                ⭐ {repository.stars.toLocaleString()}
              </span>
            )}
            {repository.relevanceScore !== undefined && (
              <span className="inline-block text-xs text-gray-600 dark:text-gray-400">
                相关度: {(repository.relevanceScore * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* 外链图标 */}
        <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}
