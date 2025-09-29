import React, { useEffect, useState } from 'react';
import { BarChart, TrendingUp } from 'lucide-react';

import { searchAPI } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchStats {
  totalRepositories: number;
  totalUsers: number;
  indexSize: number;
}

interface PopularTerm {
  name: string;
  count: number;
}

interface PopularTerms {
  languages: PopularTerm[];
  topics: PopularTerm[];
}

interface SearchAnalyticsData {
  stats: SearchStats | null;
  popular: PopularTerms | null;
}

export const SearchAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<SearchAnalyticsData>({ stats: null, popular: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [stats, popular] = await Promise.all([
          searchAPI.getSearchStats(),
          searchAPI.getPopularSearchTerms(10),
        ]);
        setAnalytics({ stats, popular });
      } catch (error) {
        console.error("获取搜索分析数据失败:", error);
        setAnalytics({ stats: null, popular: null });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!analytics.stats || analytics.stats.totalRepositories === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        暂无搜索分析数据。
      </div>
    );
  }

  const popularTerms = [
    ...(analytics.popular?.languages || []),
    ...(analytics.popular?.topics || [])
  ].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart className="h-5 w-5 text-gray-500" />
            <span>搜索统计</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.stats.totalRepositories}</div>
          <p className="text-xs text-gray-500">仓库总数</p>
          <div className="mt-2 text-sm text-gray-600">
            索引大小: {(analytics.stats.indexSize / 1024 / 1024).toFixed(2)} MB
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-gray-500" />
            <span>热门搜索词</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {popularTerms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {popularTerms.map((term) => (
                <Badge key={term.name} variant="secondary" className="text-sm">
                  {term.name}
                  <span className="ml-2 rounded-full bg-gray-300 px-2 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                    {term.count}
                  </span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">暂无热门搜索词。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
