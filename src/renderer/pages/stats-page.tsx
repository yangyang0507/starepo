import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Github,
  RefreshCw,
  TrendingUp,
  Star,
} from "lucide-react";
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
import { useCountAnimation } from "@/hooks/use-count-animation";

interface TimeSeriesItem {
  date: string;
  count: number;
  cumulative: number;
}

interface LanguageOrTopicItem {
  name: string;
  count: number;
  percentage: number;
}

interface StatsData {
  basic: {
    total_count: number;
    languages: Record<string, number>;
    topics: Record<string, number>;
    most_starred: GitHubRepository | null;
    recently_starred: GitHubRepository | null;
  };
  timeSeries: {
    monthly: TimeSeriesItem[];
    weekly: TimeSeriesItem[];
  };
  insights: {
    avgStarsPerMonth: number;
    mostActiveMonth: string;
    topLanguages: LanguageOrTopicItem[];
    topTopics: LanguageOrTopicItem[];
  };
}

interface EnhancedRepositoriesResult {
  repositories: GitHubRepository[];
  totalLoaded: number;
  fromCache: boolean;
  stats?: Record<string, unknown>;
}

function AnimatedNumber({
  value,
  duration = 1000,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const { count } = useCountAnimation(value, duration);

  return <span className={className}>{count.toLocaleString()}</span>;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass,
  delay = 0,
  onClick,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ElementType;
  colorClass: string;
  delay?: number;
  onClick?: () => void;
}) {
  return (
    <div
      className={`group bg-card text-card-foreground relative overflow-hidden rounded-xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${onClick ? "cursor-pointer" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="flex items-center gap-4 p-6">
        <div
          className={`bg-opacity-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${colorClass.replace("text-", "bg-")}`}
        >
          <Icon className={`h-6 w-6 ${colorClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm font-medium">
            {title}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-foreground truncate text-2xl font-bold tracking-tight">
              {value}
            </h3>
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 truncate text-xs">
              {subtitle}
            </p>
          )}
        </div>
        <Icon
          className={`absolute -right-4 -bottom-4 h-24 w-24 opacity-5 bg-blend-overlay ${colorClass} transition-transform group-hover:scale-110`}
        />
      </div>
    </div>
  );
}

interface StatsPageState {
  loading: boolean;
  error: string | null;
  user: GitHubUser | null;
  statsData: (StatsData & { repositories: GitHubRepository[] }) | null;
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
  const [animationKey, setAnimationKey] = useState(0);

  const loadStatsData = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const authState = (await githubAPI.getAuthState()) as AuthState;
      if (!authState.isAuthenticated) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "请先进行GitHub认证以查看统计信息",
        }));
        return;
      }

      const user = (await githubAPI.getCurrentUser()) as GitHubUser;
      const statsData = (await githubAPI.getStarredStats()) as StatsData;
      const repositoriesResult =
        (await githubAPI.getAllStarredRepositoriesEnhanced({
          useDatabase: true,
          forceRefresh: false,
        })) as EnhancedRepositoriesResult;

      setState({
        loading: false,
        error: null,
        user,
        statsData: {
          ...statsData,
          repositories: repositoriesResult.repositories || [],
        },
      });

      setAnimationKey((prev) => prev + 1);
    } catch (error) {
      console.error("加载统计数据失败:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "加载统计数据失败，请稍后重试",
      }));
    }
  };

  useEffect(() => {
    loadStatsData();
  }, []);

  const renderCardsSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-card text-card-foreground rounded-xl border p-6 shadow-sm"
        >
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

  const renderChartsSkeleton = () => (
    <div className="space-y-4 lg:space-y-6">
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );

  const renderStatsCards = () => {
    if (state.loading) return renderCardsSkeleton();
    if (!state.statsData) return null;

    const { statsData } = state;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <StatCard
          title="总收藏数"
          value={
            <AnimatedNumber
              key={`total-${animationKey}`}
              value={statsData.basic.total_count}
            />
          }
          subtitle="GitHub Star 仓库"
          icon={Github}
          colorClass="text-zinc-500 dark:text-zinc-100"
          delay={0}
        />
        <StatCard
          title="月均收藏"
          value={
            <AnimatedNumber
              key={`avg-${animationKey}`}
              value={Math.round(statsData.insights.avgStarsPerMonth)}
            />
          }
          subtitle="过去12个月平均"
          icon={TrendingUp}
          colorClass="text-blue-500"
          delay={100}
        />
        <StatCard
          title="最活跃月份"
          value={statsData.insights.mostActiveMonth || "暂无"}
          subtitle="收藏活动最频繁"
          icon={Calendar}
          colorClass="text-amber-500"
          delay={200}
        />
        <StatCard
          title="最热门语言"
          value={statsData.insights.topLanguages[0]?.name || "暂无"}
          subtitle={
            statsData.insights.topLanguages[0]
              ? `${statsData.insights.topLanguages[0].count} 个仓库`
              : "暂无数据"
          }
          icon={BarChart3}
          colorClass="text-emerald-500"
          delay={300}
        />
        <StatCard
          title="最热门主题"
          value={statsData.insights.topTopics[0]?.name || "暂无"}
          subtitle={
            statsData.insights.topTopics[0]
              ? `${statsData.insights.topTopics[0].count} 次使用`
              : "暂无数据"
          }
          icon={TrendingUp}
          colorClass="text-purple-500"
          delay={400}
        />
        <StatCard
          title="最近收藏"
          value={statsData.basic.recently_starred?.name || "暂无"}
          subtitle={statsData.basic.recently_starred?.owner.login || "暂无数据"}
          icon={Star}
          colorClass="text-yellow-500"
          delay={500}
          onClick={
            statsData.basic.recently_starred
              ? () => openExternal(statsData.basic.recently_starred!.html_url)
              : undefined
          }
        />
      </div>
    );
  };

  const renderErrorState = () => {
    if (!state.error) return null;

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">加载失败</span>
          </div>
          <p className="text-muted-foreground mb-4 text-sm">{state.error}</p>
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
          <span className="text-foreground text-sm font-semibold">
            统计分析
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={loadStatsData}
            disabled={state.loading}
            title="刷新数据"
          >
            <RefreshCw
              className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-2 pt-0 pb-4 sm:p-4">
        {renderErrorState()}
        {renderStatsCards()}

        {state.loading && renderChartsSkeleton()}

        {!state.loading && !state.error && state.statsData && (
          <div className="space-y-4 lg:space-y-6">
            <TimelineChart
              data={state.statsData.timeSeries.monthly}
              title="月度收藏趋势"
              period="month"
            />
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-2">
              <LanguageDistributionChart
                languages={state.statsData.insights.topLanguages}
              />
              <TopicsDistributionChart
                topics={state.statsData.insights.topTopics}
              />
            </div>
            <RepositoriesRanking
              repositories={state.statsData.repositories || []}
              title="热门仓库"
              onRepositoryClick={(repo) => {
                openExternal(repo.html_url);
              }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
