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
import { BarChart3 } from "lucide-react";

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

interface StarDistributionChartProps {
  repositories: Array<{ stargazers_count: number }>;
  className?: string;
}

const SEGMENTS = [
  { label: "0-100", min: 0, max: 100 },
  { label: "100-1K", min: 100, max: 1000 },
  { label: "1K-10K", min: 1000, max: 10000 },
  { label: "10K-100K", min: 10000, max: 100000 },
  { label: "100K+", min: 100000, max: Infinity },
];

export const StarDistributionChart: React.FC<StarDistributionChartProps> = ({
  repositories,
  className = "",
}) => {
  const { chartData, median, max } = useMemo(() => {
    const total = repositories.length;
    const counts = SEGMENTS.map((seg) => {
      const count = repositories.filter(
        (r) => r.stargazers_count >= seg.min && r.stargazers_count < seg.max,
      ).length;
      return {
        name: seg.label,
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    });

    const sorted = [...repositories]
      .map((r) => r.stargazers_count)
      .sort((a, b) => a - b);
    const medianVal =
      sorted.length > 0
        ? sorted.length % 2 === 0
          ? Math.round(
              (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
            )
          : sorted[Math.floor(sorted.length / 2)]
        : 0;
    const maxVal = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

    return { chartData: counts, median: medianVal, max: maxVal };
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Star 数量分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <BarChart3 className="text-muted-foreground mx-auto h-12 w-12" />
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
          <BarChart3 className="h-5 w-5" />
          Star 数量分布
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
              {repositories.length}
            </div>
            <div className="text-muted-foreground text-xs">总仓库数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {median.toLocaleString()}
            </div>
            <div className="text-muted-foreground text-xs">中位数 Star</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600 sm:text-2xl">
              {max.toLocaleString()}
            </div>
            <div className="text-muted-foreground text-xs">最高 Star</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StarDistributionChart;
