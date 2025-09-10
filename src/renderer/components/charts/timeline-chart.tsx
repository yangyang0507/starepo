import React, { useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

// 自定义 Tooltip 组件
const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.dataKey === 'cumulative' && (
              <span className="text-muted-foreground ml-1">(累积)</span>
            )}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface TimelineChartProps {
  data: Array<{
    date: string;
    count: number;
    cumulative: number;
  }>;
  title?: string;
  period?: 'month' | 'week' | 'day';
  className?: string;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  data,
  title = "收藏趋势",
  period = 'month',
  className = "",
}) => {
  // 格式化数据，添加更好的标签
  const formattedData = useMemo(() => {
    return data.map((item) => {
      let displayLabel = item.date;

      // 根据周期优化标签显示
      switch (period) {
        case 'month':
          // 显示为 "2024-01" 格式
          displayLabel = item.date;
          break;
        case 'week': {
          // 显示为 "W01" 或 "1月W1" 格式
          const [_year, week] = item.date.split('-W');
          if (week) {
            displayLabel = `W${week}`;
          }
          break;
        }
        case 'day':
          // 显示为日期
          displayLabel = item.date;
          break;
      }

      return {
        ...item,
        displayLabel,
      };
    });
  }, [data, period]);

  // 如果没有数据，显示空状态
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">暂无趋势数据</p>
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
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="displayLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
                interval={Math.max(0, Math.floor(formattedData.length / 6))}
              />
              <YAxis fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="count"
                stackId="1"
                stroke="#8884d8"
                fill="url(#countGradient)"
                name="当期收藏"
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="累积总数"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 统计摘要 */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formattedData.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground">总收藏数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formattedData.length > 0 ? Math.round(
                formattedData.reduce((sum, item) => sum + item.count, 0) / formattedData.length * 10
              ) / 10 : 0}
            </div>
            <div className="text-xs text-muted-foreground">平均每月</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {formattedData.length > 1 ?
                Math.max(...formattedData.map(item => item.count)) : 0}
            </div>
            <div className="text-xs text-muted-foreground">最多月份</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimelineChart;
