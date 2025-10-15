import React, { useState, useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart3, Calendar, Github, RefreshCw, TrendingUp } from "lucide-react";
import { githubAPI } from "@/api";
import type { GitHubUser, GitHubRepository, AuthState } from "@shared/types"
import { Skeleton } from "@/components/ui/skeleton";
import {
  LanguageDistributionChart,
  TopicsDistributionChart,
  TimelineChart,
  RepositoriesRanking,
} from "@/components/charts";

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
      console.log('[统计页面] 开始检查认证状态...');
      const authState = await githubAPI.getAuthState() as AuthState;
      console.log('[统计页面] 获取到的认证状态:', {
        isAuthenticated: authState.isAuthenticated,
        user: authState.user?.login,
        hasTokenInfo: !!authState.tokenInfo,
      });
      const isAuthenticated = authState.isAuthenticated;
      if (!isAuthenticated) {
        console.log('[统计页面] 用户未认证，显示错误信息');
        setState(prev => ({
          ...prev,
          loading: false,
          error: "请先进行GitHub认证以查看统计信息",
        }));
        return;
      }
      console.log('[统计页面] 用户已认证，继续获取数据...');

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!state.statsData) return null;

    const { statsData } = state;

    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 总收藏数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收藏数</CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber key={`total-${animationKey}`} value={statsData.basic.total_count} />
            </div>
            <p className="text-xs text-muted-foreground">
              GitHub Star 仓库
            </p>
          </CardContent>
        </Card>

        {/* 每月平均收藏 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">月均收藏</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber key={`avg-${animationKey}`} value={Math.round(statsData.insights.avgStarsPerMonth)} />
            </div>
            <p className="text-xs text-muted-foreground">
              过去12个月平均
            </p>
          </CardContent>
        </Card>

        {/* 最热门语言 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最热门语言</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{statsData.insights.topLanguages[0]?.name || "暂无"}</div>
            <p className="text-xs text-muted-foreground">
              {statsData.insights.topLanguages[0] ? (
                <>
                  <AnimatedNumber key={`lang-${animationKey}`} value={statsData.insights.topLanguages[0].count} /> 个仓库
                </>
              ) : "暂无数据"}
            </p>
          </CardContent>
        </Card>

        {/* 最热门主题 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最热门主题</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{statsData.insights.topTopics[0]?.name || "暂无"}</div>
            <p className="text-xs text-muted-foreground">
              {statsData.insights.topTopics[0] ? (
                <>
                  <AnimatedNumber key={`topic-${animationKey}`} value={statsData.insights.topTopics[0].count} /> 次使用
                </>
              ) : "暂无数据"}
            </p>
          </CardContent>
        </Card>

        {/* 最活跃月份 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最活跃月份</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">{statsData.insights.mostActiveMonth || "暂无"}</div>
            <p className="text-xs text-muted-foreground">
              收藏最多
            </p>
          </CardContent>
        </Card>

        {/* 最近收藏 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最近收藏</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold truncate">
              {statsData.basic.recently_starred?.name || "暂无"}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {statsData.basic.recently_starred?.owner.login || "暂无数据"}
            </p>
          </CardContent>
        </Card>
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
    <AppLayout title="统计分析">
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Starepo</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>统计分析</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0">
        {/* 页面标题 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">统计分析</h1>
            <p className="text-muted-foreground">
              查看您的 GitHub Star 仓库统计信息和趋势分析
            </p>
          </div>
          <Button
            className="w-full sm:w-auto sm:shrink-0"
            onClick={loadStatsData}
            disabled={state.loading}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

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
                // 处理仓库点击事件，可以跳转到仓库详情或在浏览器中打开
                window.open(repo.html_url, '_blank');
              }}
            />
          </div>
        )}

        {/* 底部间隙 */}
        <div className="h-20"></div>
      </div>
    </AppLayout>
  );
}
