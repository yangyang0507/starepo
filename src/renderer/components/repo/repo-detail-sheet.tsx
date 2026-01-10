/**
 * 仓库详情侧板组件
 * 使用 Shadcn Sheet 组件展示仓库详细信息
 */

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Star,
  GitFork,
  Eye,
  ExternalLink,
  Calendar,
  Code,
  AlertCircle,
} from 'lucide-react';
import { RepositoryReference } from '@shared/types';
import ReactMarkdown from 'react-markdown';

export interface RepoDetailSheetProps {
  repo: RepositoryReference | null;
  isOpen: boolean;
  onClose: () => void;
  onStar?: (repoId: string) => Promise<void>;
  onUnstar?: (repoId: string) => Promise<void>;
}

export function RepoDetailSheet({
  repo,
  isOpen,
  onClose,
  onStar,
  onUnstar,
}: RepoDetailSheetProps) {
  const [isStarring, setIsStarring] = useState(false);
  const [readme, setReadme] = useState<string | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);

  // 加载 README（模拟，实际需要调用 API）
  const loadReadme = async () => {
    if (!repo) return;

    setIsLoadingReadme(true);
    try {
      // TODO: 调用实际的 API 获取 README
      // const response = await fetchReadme(repo.owner, repo.repositoryName);
      // setReadme(response);

      // 临时占位
      setReadme(`# ${repo.repositoryName}\n\n${repo.description || '暂无描述'}\n\n## 功能特性\n\n暂无 README 内容。`);
    } catch (error) {
      console.error('Failed to load README:', error);
      setReadme('加载 README 失败');
    } finally {
      setIsLoadingReadme(false);
    }
  };

  // 当 Sheet 打开时加载 README
  const handleOpenChange = (open: boolean) => {
    if (open && repo && !readme) {
      loadReadme();
    }
    if (!open) {
      onClose();
      setReadme(null); // 清空 README 缓存
    }
  };

  // Star/Unstar 操作
  const handleStarToggle = async () => {
    if (!repo) return;

    setIsStarring(true);
    try {
      // TODO: 判断当前是否已 star
      const isStarred = false; // 临时

      if (isStarred) {
        await onUnstar?.(repo.repositoryId);
      } else {
        await onStar?.(repo.repositoryId);
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    } finally {
      setIsStarring(false);
    }
  };

  if (!repo) return null;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <span className="truncate">{repo.owner}/{repo.repositoryName}</span>
          </SheetTitle>
          <SheetDescription className="text-left">
            {repo.description || '暂无描述'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStarToggle}
            disabled={isStarring}
            className="gap-1"
          >
            <Star className="h-4 w-4" />
            {isStarring ? '处理中...' : 'Star'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              在 GitHub 打开
            </a>
          </Button>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          {repo.stars !== undefined && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              <span>{repo.stars.toLocaleString()}</span>
            </div>
          )}
          {repo.language && (
            <div className="flex items-center gap-1">
              <Code className="h-4 w-4" />
              <Badge variant="secondary" className="text-xs">
                {repo.language}
              </Badge>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoadingReadme ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>加载 README...</span>
              </div>
            </div>
          ) : readme ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{readme}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>暂无 README</span>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
