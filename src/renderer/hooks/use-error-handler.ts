import { useState, useCallback, useMemo } from "react";

// 错误类型定义
export interface AppError {
  id: string;
  message: string;
  code?: string;
  details?: string;
  timestamp: number;
  severity: "low" | "medium" | "high" | "critical";
  category: "network" | "auth" | "validation" | "system" | "unknown";
}

// 错误处理配置
interface ErrorHandlerConfig {
  maxErrors?: number; // 最大错误数量
  autoRemoveDelay?: number; // 自动移除延迟（毫秒）
  enableLogging?: boolean; // 是否启用日志
}

// 默认配置
const DEFAULT_CONFIG: Required<ErrorHandlerConfig> = {
  maxErrors: 10,
  autoRemoveDelay: 5000,
  enableLogging: true,
};

/**
 * 统一错误处理 Hook
 * 提供错误收集、分类、展示和管理功能
 */
export function useErrorHandler(config: ErrorHandlerConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [errors, setErrors] = useState<AppError[]>([]);

  // 生成错误ID
  const generateErrorId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 分类错误
  const categorizeError = useCallback((error: unknown): AppError["category"] => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
        return "network";
      }
      if (message.includes("auth") || message.includes("token") || message.includes("unauthorized")) {
        return "auth";
      }
      if (message.includes("validation") || message.includes("invalid")) {
        return "validation";
      }
      if (message.includes("system") || message.includes("internal")) {
        return "system";
      }
    }
    
    return "unknown";
  }, []);

  // 确定错误严重程度
  const determineSeverity = useCallback((error: unknown, category: AppError["category"]): AppError["severity"] => {
    if (category === "auth") return "high";
    if (category === "system") return "critical";
    if (category === "network") return "medium";
    if (category === "validation") return "low";
    
    // 基于错误消息判断
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("critical") || message.includes("fatal")) return "critical";
      if (message.includes("error") || message.includes("failed")) return "high";
      if (message.includes("warning") || message.includes("warn")) return "medium";
    }
    
    return "medium";
  }, []);

  // 添加错误
  const addError = useCallback((
    error: unknown,
    customMessage?: string,
    customCode?: string
  ) => {
    const category = categorizeError(error);
    const severity = determineSeverity(error, category);
    
    const appError: AppError = {
      id: generateErrorId(),
      message: customMessage || (error instanceof Error ? error.message : String(error)),
      code: customCode,
      details: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
      severity,
      category,
    };

    // 记录日志
    if (finalConfig.enableLogging) {
      const logMethod = severity === "critical" ? "error" : 
                      severity === "high" ? "error" :
                      severity === "medium" ? "warn" : "info";
      
      console[logMethod](`[ErrorHandler] ${category.toUpperCase()}:`, appError);
    }

    setErrors(prev => {
      const newErrors = [appError, ...prev];
      
      // 限制错误数量
      if (newErrors.length > finalConfig.maxErrors) {
        return newErrors.slice(0, finalConfig.maxErrors);
      }
      
      return newErrors;
    });

    // 自动移除错误（除了 critical 级别）
    if (severity !== "critical" && finalConfig.autoRemoveDelay > 0) {
      setTimeout(() => {
        removeError(appError.id);
      }, finalConfig.autoRemoveDelay);
    }

    return appError.id;
  }, [
    categorizeError,
    determineSeverity,
    generateErrorId,
    finalConfig.enableLogging,
    finalConfig.maxErrors,
    finalConfig.autoRemoveDelay,
  ]);

  // 移除错误
  const removeError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  // 清除所有错误
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // 清除特定类别的错误
  const clearErrorsByCategory = useCallback((category: AppError["category"]) => {
    setErrors(prev => prev.filter(error => error.category !== category));
  }, []);

  // 清除特定严重程度的错误
  const clearErrorsBySeverity = useCallback((severity: AppError["severity"]) => {
    setErrors(prev => prev.filter(error => error.severity !== severity));
  }, []);

  // 获取错误统计
  const errorStats = useMemo(() => {
    const stats = {
      total: errors.length,
      byCategory: {} as Record<AppError["category"], number>,
      bySeverity: {} as Record<AppError["severity"], number>,
      recent: errors.filter(error => Date.now() - error.timestamp < 60000).length, // 最近1分钟
    };

    errors.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }, [errors]);

  // 获取最新错误
  const latestError = useMemo(() => {
    return errors.length > 0 ? errors[0] : null;
  }, [errors]);

  // 获取关键错误
  const criticalErrors = useMemo(() => {
    return errors.filter(error => error.severity === "critical");
  }, [errors]);

  // 检查是否有特定类别的错误
  const hasErrorsInCategory = useCallback((category: AppError["category"]) => {
    return errors.some(error => error.category === category);
  }, [errors]);

  // 检查是否有特定严重程度的错误
  const hasErrorsWithSeverity = useCallback((severity: AppError["severity"]) => {
    return errors.some(error => error.severity === severity);
  }, [errors]);

  return {
    // 错误数据
    errors,
    errorStats,
    latestError,
    criticalErrors,
    
    // 错误操作
    addError,
    removeError,
    clearErrors,
    clearErrorsByCategory,
    clearErrorsBySeverity,
    
    // 错误检查
    hasErrorsInCategory,
    hasErrorsWithSeverity,
    
    // 便捷方法
    hasErrors: errors.length > 0,
    hasCriticalErrors: criticalErrors.length > 0,
  };
}

// 全局错误处理 Hook
export function useGlobalErrorHandler() {
  const errorHandler = useErrorHandler({
    maxErrors: 50,
    autoRemoveDelay: 10000,
    enableLogging: true,
  });

  // 处理未捕获的错误
  const handleGlobalError = useCallback((error: unknown, context?: string) => {
    return errorHandler.addError(error, context ? `[${context}] ${String(error)}` : undefined);
  }, [errorHandler]);

  // 处理 Promise 拒绝
  const handlePromiseRejection = useCallback((reason: unknown, context?: string) => {
    return errorHandler.addError(reason, context ? `[${context}] Promise rejected` : "Promise rejected");
  }, [errorHandler]);

  // 处理网络错误
  const handleNetworkError = useCallback((error: unknown, url?: string) => {
    const message = url ? `Network error for ${url}` : "Network error";
    return errorHandler.addError(error, message, "NETWORK_ERROR");
  }, [errorHandler]);

  // 处理认证错误
  const handleAuthError = useCallback((error: unknown, action?: string) => {
    const message = action ? `Authentication failed for ${action}` : "Authentication failed";
    return errorHandler.addError(error, message, "AUTH_ERROR");
  }, [errorHandler]);

  return {
    ...errorHandler,
    handleGlobalError,
    handlePromiseRejection,
    handleNetworkError,
    handleAuthError,
  };
}