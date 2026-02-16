import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      percentage: number;
      description: string;
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
        <p className="text-muted-foreground text-xs">
          {data.payload.description}
        </p>
      </div>
    );
  }
  return null;
};

const ACTIVITY_COLORS = {
  活跃: "#22c55e",
  较活跃: "#84cc16",
  一般: "#eab308",
  不活跃: "#f97316",
  已沉寂: "#ef4444",
};

interface ActivityAnalysisChartProps {
  repositories: Array<{ pushed_at: string }>;
  className?: string;
}

export const ActivityAnalysisChart: React.FC<ActivityAnalysisChartProps> = ({
  repositories,
  className = "",
}) => {
  const { chartData, activeCount, staleCount } = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;

    const segments = [
      {
        label: "活跃",
        maxDays: 30,
        description: "最近 30 天内有推送",
        color: ACTIVITY_COLORS["活跃"],
      },
      {
        label: "较活跃",
        maxDays: 90,
        description: "最近 1-3 个月有推送",
        color: ACTIVITY_COLORS["较活跃"],
      },
      {
        label: "一般",
        maxDays: 365,
        description: "最近 3-12 个月有推送",
        color: ACTIVITY_COLORS["一般"],
      },
      {
        label: "不活跃",
        maxDays: 730,
        description: "1-2 年未推送",
        color: ACTIVITY_COLORS["不活跃"],
      },
      {
        label: "已沉寂",
        maxDays: Infinity,
        description: "超过 2 年未推送",
        color: ACTIVITY_COLORS["已沉寂"],
      },
    ];

    const total = repositories.length;
    let prevMax = 0;
    const data = segments.map((seg) => {
      const count = repositories.filter((r) => {
        const daysSince = (now - new Date(r.pushed_at).getTime()) / DAY;
        return daysSince >= prevMax && daysSince < seg.maxDays;
      }).length;
      prevMax = seg.maxDays;
      return {
        name: seg.label,
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        description: seg.description,
        color: seg.color,
      };
    });

    const active = data[0].value + data[1].value;
    const stale = data[3].value + data[4].value;

    return { chartData: data, activeCount: active, staleCount: stale };
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            仓库活跃度分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <Activity className="text-muted-foreground mx-auto h-12 w-12" />
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
          <Activity className="h-5 w-5" />
          仓库活跃度分析
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
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {activeCount}
            </div>
            <div className="text-muted-foreground text-xs">活跃仓库</div>
          </div>
          <div className="text-center">
            <div className="text-primary text-lg font-bold sm:text-2xl">
              {repositories.length}
            </div>
            <div className="text-muted-foreground text-xs">总仓库数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600 sm:text-2xl">
              {staleCount}
            </div>
            <div className="text-muted-foreground text-xs">不活跃仓库</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityAnalysisChart;
