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
import { Scale } from "lucide-react";

const LICENSE_COLORS: Record<string, string> = {
  MIT: "#22c55e",
  "Apache-2.0": "#3b82f6",
  "GPL-3.0": "#ef4444",
  "GPL-2.0": "#f97316",
  "BSD-2-Clause": "#8b5cf6",
  "BSD-3-Clause": "#a855f7",
  ISC: "#06b6d4",
  "MPL-2.0": "#eab308",
  "LGPL-3.0": "#ec4899",
  Unlicense: "#6b7280",
  未指定: "#9ca3af",
};

const getLicenseColor = (name: string): string => {
  return LICENSE_COLORS[name] || "#6b7280";
};

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
    <div className="mt-4 flex flex-wrap justify-center gap-2">
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

interface LicenseDistributionChartProps {
  repositories: Array<{
    license?: { spdx_id: string; name: string } | null;
  }>;
  className?: string;
}

export const LicenseDistributionChart: React.FC<
  LicenseDistributionChartProps
> = ({ repositories, className = "" }) => {
  const { chartData, licenseList } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const repo of repositories) {
      const name =
        repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION"
          ? repo.license.spdx_id
          : "未指定";
      counts[name] = (counts[name] || 0) + 1;
    }

    const total = repositories.length;
    const sorted = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color: getLicenseColor(name),
      }))
      .sort((a, b) => b.value - a.value);

    return {
      chartData: sorted.slice(0, 8),
      licenseList: sorted,
    };
  }, [repositories]);

  if (!repositories || repositories.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            许可证分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <Scale className="text-muted-foreground mx-auto h-12 w-12" />
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
          <Scale className="h-5 w-5" />
          许可证分布
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

        <div className="mt-2 space-y-2 sm:mt-4">
          <h4 className="text-muted-foreground text-sm font-medium">
            详细统计
          </h4>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {licenseList.slice(0, 4).map((item) => (
              <div
                key={item.name}
                className="bg-muted/30 flex items-center justify-between rounded-md p-1 text-xs sm:p-2 sm:text-sm"
              >
                <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full sm:h-3 sm:w-3"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="text-muted-foreground flex flex-shrink-0 items-center gap-1 text-xs">
                  <span className="font-medium">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
          {licenseList.length > 4 && (
            <div className="text-muted-foreground pt-1 text-center text-xs sm:pt-2">
              还有 {licenseList.length - 4} 种其他许可证...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LicenseDistributionChart;
