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
import { Tag } from "lucide-react";

// 定义数据类型
interface _TopicData {
  topic: string;
  count: number;
  percentage: number;
}

// 自定义 Tooltip 组件的类型定义
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

// 自定义 Tooltip 组件
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">
          {data.value} 次使用 ({data.payload.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

interface TopicsDistributionChartProps {
  topics: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

export const TopicsDistributionChart: React.FC<TopicsDistributionChartProps> = ({
  topics,
  className = "",
}) => {
  // 准备图表数据
  const chartData = useMemo(() => {
    return topics.slice(0, 10).map((topic) => ({
      name: topic.name.length > 12 ? `${topic.name.slice(0, 12)}...` : topic.name,
      fullName: topic.name,
      value: topic.count,
      percentage: topic.percentage,
    }));
  }, [topics]);

  // 如果没有数据，显示空状态
  if (!topics || topics.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            主题标签分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">暂无主题数据</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          主题标签分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 sm:h-72 lg:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 10,
                right: 10,
                left: 10,
                bottom: 60,
              }}
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

        {/* 主题统计列表 */}
        <div className="mt-2 sm:mt-4 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">热门主题</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {topics.slice(0, 6).map((topic, index) => (
              <div key={topic.name} className="flex items-center justify-between text-xs sm:text-sm p-1 sm:p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <div className="flex-shrink-0 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                    {index + 1}
                  </div>
                  <span className="truncate" title={topic.name}>
                    {topic.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
                  <span className="font-medium text-xs">{topic.count}</span>
                </div>
              </div>
            ))}
          </div>
          {topics.length > 6 && (
            <div className="text-xs text-muted-foreground text-center pt-1 sm:pt-2">
              还有 {topics.length - 6} 个其他主题...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopicsDistributionChart;
