import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star, GitFork, Eye, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { GitHubRepository } from "@shared/types";
import { useExternalLink } from "@/hooks/use-external-link";

interface RepositoriesRankingProps {
  repositories: GitHubRepository[];
  title?: string;
  limit?: number;
  className?: string;
  onRepositoryClick?: (repo: GitHubRepository) => void;
}

type SortField = 'stargazers_count' | 'forks_count' | 'watchers_count' | 'updated_at' | 'name';
type SortDirection = 'asc' | 'desc';

export const RepositoriesRanking: React.FC<RepositoriesRankingProps> = ({
  repositories,
  title = "热门仓库排行",
  limit = 10,
  className = "",
  onRepositoryClick,
}) => {
  const [sortField, setSortField] = useState<SortField>('stargazers_count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { openExternal } = useExternalLink();

  // 排序仓库
  const sortedRepositories = React.useMemo(() => {
    return [...repositories]
      .sort((a, b) => {
        let aValue: string | number, bValue: string | number;

        switch (sortField) {
          case 'stargazers_count':
            aValue = a.stargazers_count;
            bValue = b.stargazers_count;
            break;
          case 'forks_count':
            aValue = a.forks_count;
            bValue = b.forks_count;
            break;
          case 'watchers_count':
            aValue = a.watchers_count;
            bValue = b.watchers_count;
            break;
          case 'updated_at':
            aValue = new Date(a.updated_at || 0).getTime();
            bValue = new Date(b.updated_at || 0).getTime();
            break;
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      })
      .slice(0, limit);
  }, [repositories, sortField, sortDirection, limit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({
    field,
    children
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-1 font-medium"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ?
          <ChevronUp className="ml-1 h-3 w-3" /> :
          <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  );

  // 如果没有数据，显示空状态
  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Star className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">暂无仓库数据</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* 桌面端表格 */}
        <div className="hidden sm:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <SortButton field="name">仓库名称</SortButton>
                </TableHead>
                <TableHead className="text-center">
                  <SortButton field="stargazers_count">
                    <Star className="inline h-4 w-4 mr-1" />
                    Stars
                  </SortButton>
                </TableHead>
                <TableHead className="text-center">
                  <SortButton field="forks_count">
                    <GitFork className="inline h-4 w-4 mr-1" />
                    Forks
                  </SortButton>
                </TableHead>
                <TableHead className="text-center">
                  <SortButton field="watchers_count">
                    <Eye className="inline h-4 w-4 mr-1" />
                    Watchers
                  </SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="updated_at">最后更新</SortButton>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRepositories.map((repo, index) => (
                <TableRow
                  key={repo.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRepositoryClick?.(repo)}
                >
                  <TableCell className="font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate" title={repo.full_name}>
                          {repo.name}
                        </span>
                        {repo.language && (
                          <Badge variant="secondary" className="text-xs">
                            {repo.language}
                          </Badge>
                        )}
                        {repo.private && (
                          <Badge variant="outline" className="text-xs">
                            Private
                          </Badge>
                        )}
                        {repo.archived && (
                          <Badge variant="outline" className="text-xs">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate" title={repo.description || ''}>
                        {repo.description || '暂无描述'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">
                        {repo.stargazers_count.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <GitFork className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">
                        {repo.forks_count.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Eye className="h-4 w-4 text-green-500" />
                      <span className="font-medium">
                        {repo.watchers_count.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(repo.updated_at || new Date()).toLocaleDateString('zh-CN')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExternal(repo.html_url);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 移动端列表 */}
        <div className="sm:hidden space-y-2 px-4">
          {sortedRepositories.map((repo, index) => (
            <div
              key={repo.id}
              className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => onRepositoryClick?.(repo)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-muted-foreground text-sm">#{index + 1}</span>
                  <span className="font-medium truncate" title={repo.full_name}>
                    {repo.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternal(repo.html_url);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>

              <div className="text-sm text-muted-foreground mb-2 truncate">
                {repo.description || '暂无描述'}
              </div>

              <div className="flex items-center gap-2 mb-2">
                {repo.language && (
                  <Badge variant="secondary" className="text-xs">
                    {repo.language}
                  </Badge>
                )}
                {repo.private && (
                  <Badge variant="outline" className="text-xs">
                    Private
                  </Badge>
                )}
                {repo.archived && (
                  <Badge variant="outline" className="text-xs">
                    Archived
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  <span>{repo.stargazers_count.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <GitFork className="h-3 w-3 text-blue-500" />
                  <span>{repo.forks_count.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-green-500" />
                  <span>{repo.watchers_count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {repositories.length > limit && (
          <div className="text-xs text-muted-foreground text-center mt-4">
            显示前 {limit} 个仓库，共 {repositories.length} 个仓库
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RepositoriesRanking;
