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

// 定义数据类型
interface _LanguageData {
  language: string;
  count: number;
  percentage: number;
  color: string;
}

// 自定义 Tooltip 组件的类型定义
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
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-medium">{data.payload.language}</p>
        <p className="text-sm text-muted-foreground">
          {data.value} 个仓库 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

// 自定义 Legend 组件
const CustomLegend: React.FC<{ payload?: Array<{ color: string; value: string }> }> = ({ payload }) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {payload?.map((entry, index: number) => (
        <div key={index} className="flex items-center gap-1 text-xs">
          <div
            className="w-3 h-3 rounded-full"
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
            <div className="text-center space-y-2">
              <Code className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">暂无语言数据</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          编程语言分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 sm:h-72 lg:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={60}
                innerRadius={30}
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
        <div className="mt-2 sm:mt-4 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">详细统计</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {languages.slice(0, 4).map((lang) => (
              <div key={lang.name} className="flex items-center justify-between text-xs sm:text-sm p-1 sm:p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <div
                    className="w-2 sm:w-3 h-2 sm:h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getLanguageColor(lang.name) }}
                  />
                  <span className="truncate">{lang.name}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0 text-xs">
                  <span className="font-medium">{lang.count}</span>
                </div>
              </div>
            ))}
          </div>
          {languages.length > 4 && (
            <div className="text-xs text-muted-foreground text-center pt-1 sm:pt-2">
              还有 {languages.length - 4} 种其他语言...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// 使用 React.memo 优化性能
const MemoizedLanguageDistributionChart = React.memo(LanguageDistributionChart, (prevProps, nextProps) => {
  // 比较 languages 数组的内容
  if (prevProps.languages.length !== nextProps.languages.length) {
    return false;
  }

  for (let i = 0; i < prevProps.languages.length; i++) {
    const prev = prevProps.languages[i];
    const next = nextProps.languages[i];
    if (prev.name !== next.name || prev.count !== next.count || prev.percentage !== next.percentage) {
      return false;
    }
  }

  return prevProps.className === nextProps.className;
});

// 同时提供默认导出和命名导出
export { MemoizedLanguageDistributionChart as LanguageDistributionChart };
export default MemoizedLanguageDistributionChart;
