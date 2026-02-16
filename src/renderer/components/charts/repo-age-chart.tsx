import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      percentage: number;
    };
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background rounded-lg border p-3 shadow-md">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">
          {data.value} 个仓库 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

interface RepoAgeChartProps {
  repositories: Array<{ created_at: string | null }>;
  className?: string;
}

export const RepoAgeChart: React.FC<RepoAgeChartProps> = ({
  repositories,
  className = "",
}) => {
  const { chartData, avgAge, newestYear, oldestYear } = useMemo(() => {
    const now = Date.now();
    const YEAR = 365.25 * 86400000;
    const validRepos = repositories.filter(
      (r): r is { created_at: string } => r.created_at !== null,
    );

    const segments = [
      { label: "<1年", maxYears: 1 },
      { label: "1-2年", maxYears: 2 },
      { label: "2-5年", maxYears: 5 },
      { label: "5-10年", maxYears: 10 },
      { label: "10年+", maxYears: Infinity },
    ];

    const total = validRepos.length;
    let prevMax = 0;
    const data = segments.map((seg) => {
      const count = validRepos.filter((r) => {
        const ageYears = (now - new Date(r.created_at).getTime()) / YEAR;
        return ageYears >= prevMax && ageYears < seg.maxYears;
      }).length;
      prevMax = seg.maxYears;
      return {
        name: seg.label,
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    });

    const ages = validRepos.map(
      (r) => (now - new Date(r.created_at).getTime()) / YEAR,
    );
    const avg =
      ages.length > 0
        ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
        : 0;

    const years = validRepos.map((r) => new Date(r.created_at).getFullYear());
    const newest = years.length > 0 ? Math.max(...years) : 0;
    const oldest = years.length > 0 ? Math.min(...years) : 0;

    return {
      chartData: data,
      avgAge: avg,
      newestYear: newest,
      oldestYear: oldest,
    };
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            仓库年龄分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <Clock className="text-muted-foreground mx-auto h-12 w-12" />
              <p className="text-muted-foreground">暂无数据</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${className}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          仓库年龄分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 w-full sm:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={10} interval={0} />
              <YAxis fontSize={10} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                fill="#8884d8"
                radius={[4, 4, 0, 0]}
                className="fill-primary"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4">
          <div className="text-center">
            <div className="text-primary text-lg font-bold sm:text-2xl">
              {avgAge}年
            </div>
            <div className="text-muted-foreground text-xs">平均年龄</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {newestYear}
            </div>
            <div className="text-muted-foreground text-xs">最新创建</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600 sm:text-2xl">
              {oldestYear}
            </div>
            <div className="text-muted-foreground text-xs">最早创建</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RepoAgeChart;
