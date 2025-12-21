import React, { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart3, Calendar, Github, RefreshCw, TrendingUp, Star } from "lucide-react";
import { githubAPI } from "@/api";
import type { GitHubUser, GitHubRepository, AuthState } from "@shared/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LanguageDistributionChart,
  TopicsDistributionChart,
  TimelineChart,
  RepositoriesRanking,
} from "@/components/charts";
import { useExternalLink } from "@/hooks/use-external-link";

// 数字动画 Hook
const useCountAnimation = (end: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated || end === 0) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // 使用缓动函数使动画更自然
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(end * easeOutQuart));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
        setHasAnimated(true);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, hasAnimated]);

  const reset = () => setHasAnimated(false);

  return { count, reset };
};

// 动画数字组件
const AnimatedNumber: React.FC<{
  value: number;
  duration?: number;
  className?: string;
}> = ({ value, duration = 1000, className = "" }) => {
  const { count } = useCountAnimation(value, duration);

  return (
    <span className={className}>
      {count.toLocaleString()}
    </span>
  );
};

// KPI 卡片组件
const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
  colorClass: string;
  delay?: number;
  onClick?: () => void;
}> = ({ title, value, subtitle, icon: Icon, colorClass, delay = 0, onClick }) => (
  <div
    className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`}
    style={{ animationDelay: `${delay}ms` }}
    onClick={onClick}
  >
    <div className="p-6 flex items-center gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <h3 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {value}
          </h3>
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {/* 装饰性背景图标 */}
      <Icon className={`absolute -right-4 -bottom-4 h-24 w-24 opacity-5 bg-blend-overlay ${colorClass} transition-transform group-hover:scale-110`} />
    </div>
  </div>
);

interface StatsPageState {
  loading: boolean;
  error: string | null;
  user: GitHubUser | null;
  statsData: {
    basic: {
      total_count: number;
      languages: Record<string, number>;
      topics: Record<string, number>;
      most_starred: GitHubRepository | null;
      recently_starred: GitHubRepository | null;
    };
    timeSeries: {
      monthly: Array<{
        date: string;
        count: number;
        cumulative: number;
      }>;
      weekly: Array<{
        date: string;
        count: number;
        cumulative: number;
      }>;
    };
    insights: {
      avgStarsPerMonth: number;
      mostActiveMonth: string;
      topLanguages: Array<{ name: string; count: number; percentage: number }>;
      topTopics: Array<{ name: string; count: number; percentage: number }>;
    };
    repositories: GitHubRepository[]; // 添加完整仓库数据
  } | null;
}

export default function StatsPage() {
  const { t: _t } = useTranslation();
  const { openExternal } = useExternalLink();
  const [state, setState] = useState<StatsPageState>({
    loading: true,
    error: null,
    user: null,
    statsData: null,
  });
  const [animationKey, setAnimationKey] = useState(0); // 用于重置动画

  // 加载统计数据
  const loadStatsData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 检查认证状态
      const authState = await githubAPI.getAuthState() as AuthState;
      const isAuthenticated = authState.isAuthenticated;
      if (!isAuthenticated) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: "请先进行GitHub认证以查看统计信息",
        }));
        return;
      }

      // 获取用户信息
      const user = await githubAPI.getCurrentUser() as GitHubUser;

      // 获取扩展统计数据
      const statsData = await githubAPI.getStarredStats() as any;

      // 获取完整的仓库数据用于排行榜
      const repositoriesResult = await githubAPI.getAllStarredRepositoriesEnhanced({
        useDatabase: true,
        forceRefresh: false,
      }) as any;

      setState({
        loading: false,
        error: null,
        user,
        statsData: {
          ...statsData,
          repositories: repositoriesResult.repositories || [],
        },
      });

      // 重置动画状态，让数字重新动画
      setAnimationKey(prev => prev + 1);
    } catch (error) {
      console.error("加载统计数据失败:", error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "加载统计数据失败，请稍后重试",
      }));
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  const renderStatsCards = () => {
    if (state.loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!state.statsData) return null;

    const { statsData } = state;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {/* 总收藏数 */}
        <StatCard
          title="总收藏数"
          value={<AnimatedNumber key={`total-${animationKey}`} value={statsData.basic.total_count} />}
          subtitle="GitHub Star 仓库"
          icon={Github}
          colorClass="text-zinc-500 dark:text-zinc-100"
          delay={0}
        />

        {/* 月均收藏 */}
        <StatCard
          title="月均收藏"
          value={<AnimatedNumber key={`avg-${animationKey}`} value={Math.round(statsData.insights.avgStarsPerMonth)} />}
          subtitle="过去12个月平均"
          icon={TrendingUp}
          colorClass="text-blue-500"
          delay={100}
        />

        {/* 活跃月份 */}
        <StatCard
          title="最活跃月份"
          value={statsData.insights.mostActiveMonth || "暂无"}
          subtitle="收藏活动最频繁"
          icon={Calendar}
          colorClass="text-amber-500"
          delay={200}
        />

        {/* 最热门语言 */}
        <StatCard
          title="最热门语言"
          value={statsData.insights.topLanguages[0]?.name || "暂无"}
          subtitle={statsData.insights.topLanguages[0] ? `${statsData.insights.topLanguages[0].count} 个仓库` : "暂无数据"}
          icon={BarChart3}
          colorClass="text-emerald-500"
          delay={300}
        />

        {/* 最热门主题 */}
        <StatCard
          title="最热门主题"
          value={statsData.insights.topTopics[0]?.name || "暂无"}
          subtitle={statsData.insights.topTopics[0] ? `${statsData.insights.topTopics[0].count} 次使用` : "暂无数据"}
          icon={TrendingUp}
          colorClass="text-purple-500"
          delay={400}
        />

        {/* 最近收藏 */}
        <StatCard
          title="最近收藏"
          value={statsData.basic.recently_starred?.name || "暂无"}
          subtitle={statsData.basic.recently_starred?.owner.login || "暂无数据"}
          icon={Star}
          colorClass="text-yellow-500"
          delay={500}
          onClick={statsData.basic.recently_starred ? () => openExternal(statsData.basic.recently_starred!.html_url) : undefined}
        />
      </div>
    );
  };

  const renderErrorState = () => {
    if (!state.error) return null;

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive mb-4">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">加载失败</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{state.error}</p>
          <Button onClick={loadStatsData} disabled={state.loading}>
            {state.loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                重新加载中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新加载
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout
      title={
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">统计分析</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={loadStatsData}
            disabled={state.loading}
            title="刷新数据"
          >
            <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-2 sm:p-4 pt-0 h-full overflow-y-auto pb-4">
        {/* 错误状态 */}
        {renderErrorState()}

        {/* 统计卡片 */}
        {renderStatsCards()}

        {/* 图表区域 */}
        {!state.loading && !state.error && state.statsData && (
          <div className="space-y-4 lg:space-y-6">
            {/* 时间趋势图表 */}
            <TimelineChart
              data={state.statsData.timeSeries.monthly}
              title="月度收藏趋势"
              period="month"
            />

            {/* 编程语言和主题分布 */}
            <div className="grid gap-4 lg:gap-6 lg:grid-cols-2 xl:grid-cols-2">
              <LanguageDistributionChart
                languages={state.statsData.insights.topLanguages}
              />
              <TopicsDistributionChart
                topics={state.statsData.insights.topTopics}
              />
            </div>

            {/* 热门仓库排行榜 */}
            <RepositoriesRanking
              repositories={state.statsData.repositories || []}
              title="热门仓库"
              onRepositoryClick={(repo) => {
                // 在用户默认浏览器中打开仓库
                openExternal(repo.html_url);
              }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
