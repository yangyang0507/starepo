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
import { Code } from "lucide-react";

// 获取编程语言的颜色
const getLanguageColor = (language: string): string => {
  const colors: Record<string, string> = {
    JavaScript: "#f1e05a",
    TypeScript: "#2b7489",
    Python: "#3572A5",
    Java: "#b07219",
    Go: "#00ADD8",
    Rust: "#dea584",
    "C++": "#f34b7d",
    "C#": "#239120",
    PHP: "#4F5D95",
    Ruby: "#701516",
    Swift: "#ffac45",
    Kotlin: "#F18E33",
    Dart: "#00B4AB",
    Shell: "#89e051",
    HTML: "#e34c26",
    CSS: "#1572B6",
    Vue: "#4FC08D",
    React: "#61DAFB",
  };
  return colors[language] || "#6b7280";
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      language: string;
      percentage: number;
      color: string;
    };
  }>;
  label?: string;
}

// 自定义 Tooltip 组件
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background rounded-lg border p-3 shadow-md">
        <p className="font-medium">{data.payload.language}</p>
        <p className="text-muted-foreground text-sm">
          {data.value} 个仓库 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

// 自定义 Legend 组件
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

interface LanguageDistributionChartProps {
  languages: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

const LanguageDistributionChart: React.FC<LanguageDistributionChartProps> = ({
  languages,
  className = "",
}) => {
  // 准备图表数据
  const chartData = useMemo(() => {
    return languages.slice(0, 8).map((lang) => ({
      language: lang.name,
      value: lang.count,
      percentage: lang.percentage,
      color: getLanguageColor(lang.name),
    }));
  }, [languages]);

  // 如果没有数据，显示空状态
  if (!languages || languages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            编程语言分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="space-y-2 text-center">
              <Code className="text-muted-foreground mx-auto h-12 w-12" />
              <p className="text-muted-foreground">暂无语言数据</p>
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
          <Code className="h-5 w-5" />
          编程语言分布
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

        {/* 语言统计列表 */}
        <div className="mt-2 space-y-2 sm:mt-4">
          <h4 className="text-muted-foreground text-sm font-medium">
            详细统计
          </h4>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {languages.slice(0, 4).map((lang) => (
              <div
                key={lang.name}
                className="bg-muted/30 flex items-center justify-between rounded-md p-1 text-xs sm:p-2 sm:text-sm"
              >
                <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full sm:h-3 sm:w-3"
                    style={{ backgroundColor: getLanguageColor(lang.name) }}
                  />
                  <span className="truncate">{lang.name}</span>
                </div>
                <div className="text-muted-foreground flex flex-shrink-0 items-center gap-1 text-xs">
                  <span className="font-medium">{lang.count}</span>
                </div>
              </div>
            ))}
          </div>
          {languages.length > 4 && (
            <div className="text-muted-foreground pt-1 text-center text-xs sm:pt-2">
              还有 {languages.length - 4} 种其他语言...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { LanguageDistributionChart };
export default LanguageDistributionChart;
