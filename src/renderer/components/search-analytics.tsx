import React, { useEffect, useState } from 'react';
import { BarChart, TrendingUp } from 'lucide-react';

import { getSearchEngine } from '@/services/search';
import type {
  SearchAnalyticsStats,
  SearchSuggestion,
} from '@/services/search/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchAnalyticsData {
  stats: SearchAnalyticsStats | null;
  popular: SearchSuggestion[];
}

export const SearchAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<SearchAnalyticsData>({ stats: null, popular: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const searchEngine = getSearchEngine();
        const [stats, popular] = await Promise.all([
          searchEngine.getSearchStatistics(),
          searchEngine.getPopularSearches(10),
        ]);
        setAnalytics({ stats, popular });
      } catch (error) {
        console.error("Failed to fetch search analytics:", error);
        setAnalytics({ stats: null, popular: [] });
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

  if (!analytics.stats || analytics.stats.totalSearches === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        暂无搜索分析数据。
      </div>
    );
  }

  const popularTerms = Object.entries(analytics.stats.popularTerms || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

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
          <div className="text-2xl font-bold">{analytics.stats.totalSearches}</div>
          <p className="text-xs text-gray-500">总搜索次数</p>
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
              {popularTerms.map(([term, freq]) => (
                <Badge key={term} variant="secondary" className="text-sm">
                  {term}
                  <span className="ml-2 rounded-full bg-gray-300 px-2 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-200">
                    {freq}
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
