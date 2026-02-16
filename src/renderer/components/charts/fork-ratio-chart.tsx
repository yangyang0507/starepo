import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitFork } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      name: string;
      percentage: number;
      color: string;
    };
  }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background rounded-lg border p-3 shadow-md">
        <p className="font-medium">{data.payload.name}</p>
        <p className="text-muted-foreground text-sm">
          {data.value} 个仓库 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend: React.FC<{
  payload?: Array<{ color: string; value: string }>;
}> = ({ payload }) => {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4">
      {payload?.map((entry, index: number) => (
        <div key={index} className="flex items-center gap-1 text-xs">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const COLORS = {
  original: "#22c55e",
  fork: "#3b82f6",
};

interface ForkRatioChartProps {
  repositories: Array<{ fork: boolean }>;
  className?: string;
}

export const ForkRatioChart: React.FC<ForkRatioChartProps> = ({
  repositories,
  className = "",
}) => {
  const chartData = useMemo(() => {
    const total = repositories.length;
    const forkCount = repositories.filter((r) => r.fork).length;
    const originalCount = total - forkCount;

    return [
      {
        name: "原创仓库",
        value: originalCount,
        percentage: total > 0 ? (originalCount / total) * 100 : 0,
        color: COLORS.original,
      },
      {
        name: "Fork 仓库",
        value: forkCount,
        percentage: total > 0 ? (forkCount / total) * 100 : 0,
        color: COLORS.fork,
      },
    ];
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            Fork vs 原创
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <GitFork className="text-muted-foreground mx-auto h-12 w-12" />
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
          <GitFork className="h-5 w-5" />
          Fork vs 原创
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 w-full sm:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius="70%"
                innerRadius="35%"
                dataKey="value"
                label={false}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="bg-muted/30 flex items-center justify-between rounded-md p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">{item.value}</span>
                <span className="ml-1">({item.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ForkRatioChart;
