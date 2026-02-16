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
import { Users } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      percentage: number;
      fullName: string;
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
        <p className="font-medium">{data.payload.fullName || label}</p>
        <p className="text-muted-foreground text-sm">
          {data.value} 个仓库 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

interface OwnerDistributionChartProps {
  repositories: Array<{
    owner: { login: string; avatar_url: string };
  }>;
  className?: string;
}

export const OwnerDistributionChart: React.FC<OwnerDistributionChartProps> = ({
  repositories,
  className = "",
}) => {
  const { chartData, ownerList } = useMemo(() => {
    const counts: Record<string, { count: number; avatar: string }> = {};
    for (const repo of repositories) {
      const login = repo.owner.login;
      if (!counts[login]) {
        counts[login] = { count: 0, avatar: repo.owner.avatar_url };
      }
      counts[login].count++;
    }

    const total = repositories.length;
    const sorted = Object.entries(counts)
      .map(([name, { count, avatar }]) => ({
        name: name.length > 10 ? `${name.slice(0, 10)}...` : name,
        fullName: name,
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        avatar,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      chartData: sorted.slice(0, 10),
      ownerList: sorted,
    };
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            仓库所有者分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <Users className="text-muted-foreground mx-auto h-12 w-12" />
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
          <Users className="h-5 w-5" />
          仓库所有者分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 w-full sm:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                fontSize={10}
                interval={0}
              />
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

        <div className="mt-2 space-y-2 sm:mt-4">
          <h4 className="text-muted-foreground text-sm font-medium">
            热门所有者
          </h4>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ownerList.slice(0, 6).map((owner, index) => (
              <div
                key={owner.fullName}
                className="bg-muted/30 flex items-center justify-between rounded-md p-1 text-xs sm:p-2 sm:text-sm"
              >
                <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                  <div className="bg-primary/20 text-primary flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium sm:h-5 sm:w-5">
                    {index + 1}
                  </div>
                  <span className="truncate" title={owner.fullName}>
                    {owner.fullName}
                  </span>
                </div>
                <div className="text-muted-foreground flex flex-shrink-0 items-center gap-1">
                  <span className="text-xs font-medium">{owner.value}</span>
                </div>
              </div>
            ))}
          </div>
          {ownerList.length > 6 && (
            <div className="text-muted-foreground pt-1 text-center text-xs sm:pt-2">
              还有 {ownerList.length - 6} 个其他所有者...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OwnerDistributionChart;
