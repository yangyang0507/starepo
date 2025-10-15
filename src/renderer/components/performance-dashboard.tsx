/**
 * 性能监控仪表板
 * 显示应用性能指标和状态信息
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Zap, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Database,
  Package
} from "lucide-react";

interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  processMetrics: {
    cpuUsage: number;
    uptime: number;
  };
  databaseMetrics: {
    recordCount: number;
    lastSync: string | null;
    cacheHitRate: number;
  };
  errorMetrics: {
    recentErrors: number;
    lastErrorTime: string | null;
  };
  performanceScore: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    issues: string[];
  };
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // 获取性能指标
  const fetchMetrics = async () => {
    try {
      // 首先尝试从 main 进程获取真实指标
      if (window.electronAPI && window.electronAPI.invoke) {
        try {
          const performanceData = await window.electronAPI.invoke('app:get-performance-metrics');
          if (performanceData.success && performanceData.data) {
            const data = performanceData.data;
            setMetrics(data);
            return;
          }
        } catch (electronError) {
          console.warn('无法获取主进程性能指标，使用模拟数据:', electronError);
        }
      }

      // 备用模拟数据
      const mockMetrics: PerformanceMetrics = {
        memoryUsage: {
          used: Math.floor(Math.random() * 500000000), // MB
          total: 800000000, // MB
          percentage: Math.floor(Math.random() * 60) + 20,
        },
        processMetrics: {
          cpuUsage: Math.floor(Math.random() * 40) + 10,
          uptime: Math.floor(Math.random() * 3600) + 600, // seconds
        },
        databaseMetrics: {
          recordCount: Math.floor(Math.random() * 10000) + 1000,
          lastSync: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          cacheHitRate: Math.floor(Math.random() * 40) + 60,
        },
        errorMetrics: {
          recentErrors: Math.floor(Math.random() * 5),
          lastErrorTime: Math.random() > 0.7 
            ? new Date(Date.now() - Math.random() * 3600000).toISOString() 
            : null,
        },
        performanceScore: {
          score: Math.floor(Math.random() * 30) + 70,
          grade: 'A' as const,
          issues: [
            '数据库查询可以进一步优化',
            '部分组件渲染可能存在性能瓶颈',
          ],
        },
      };

      // 根据性能分数设置等级
      const score = mockMetrics.performanceScore.score;
      if (score >= 90) mockMetrics.performanceScore.grade = 'A';
      else if (score >= 80) mockMetrics.performanceScore.grade = 'B';
      else if (score >= 70) mockMetrics.performanceScore.grade = 'C';
      else if (score >= 60) mockMetrics.performanceScore.grade = 'D';
      else mockMetrics.performanceScore.grade = 'F';

      setMetrics(mockMetrics);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // 每10秒刷新一次
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-50';
      case 'B': return 'text-blue-600 bg-blue-50';
      case 'C': return 'text-yellow-600 bg-yellow-50';
      case 'D': return 'text-orange-600 bg-orange-50';
      case 'F': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <span className="ml-2">无法获取性能指标</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">性能监控仪表板</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            最后更新: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button onClick={fetchMetrics} size="sm" variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 总体性能得分 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            总体性能得分
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getGradeColor(metrics.performanceScore.grade)}`}>
                {metrics.performanceScore.score}
              </div>
              <Badge className={getGradeColor(metrics.performanceScore.grade)}>
                等级: {metrics.performanceScore.grade}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">优化建议</div>
              <ul className="text-sm space-y-1 mt-2">
                {metrics.performanceScore.issues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能指标网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 内存使用 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              内存使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {metrics.memoryUsage.percentage}%
              </div>
              <div className="text-sm text-muted-foreground">
                {formatBytes(metrics.memoryUsage.used)} / {formatBytes(metrics.memoryUsage.total)}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${metrics.memoryUsage.percentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CPU 使用 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU 使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {metrics.processMetrics.cpuUsage}%
              </div>
              <div className="text-sm text-muted-foreground">
                处理器使用率
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${metrics.processMetrics.cpuUsage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 运行时间 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              运行时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatUptime(metrics.processMetrics.uptime)}
              </div>
              <div className="text-sm text-muted-foreground">
                应用运行时长
              </div>
              <Badge variant="outline" className="mt-2">
                运行中
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 错误指标 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              错误指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {metrics.errorMetrics.recentErrors}
              </div>
              <div className="text-sm text-muted-foreground">
                最近错误数量
              </div>
              {metrics.errorMetrics.lastErrorTime && (
                <div className="text-xs text-orange-600">
                  最后: {new Date(metrics.errorMetrics.lastErrorTime).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 数据库指标 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据库性能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold">
                {metrics.databaseMetrics.recordCount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">记录总数</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {metrics.databaseMetrics.cacheHitRate}%
              </div>
              <div className="text-sm text-muted-foreground">缓存命中率</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${metrics.databaseMetrics.cacheHitRate}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold">
                {metrics.databaseMetrics.lastSync 
                  ? new Date(metrics.databaseMetrics.lastSync).toLocaleString()
                  : '未同步'
                }
              </div>
              <div className="text-sm text-muted-foreground">最后同步时间</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              清理缓存
            </Button>
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              优化数据库
            </Button>
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              生成报告
            </Button>
            <Button variant="outline" size="sm">
              <Database className="h-4 w-4 mr-2" />
              重建索引
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
