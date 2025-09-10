import { useState, useEffect, useCallback, useMemo } from "react";

// 断点定义（与 Tailwind CSS 保持一致）
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

// 屏幕尺寸类型
export type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * 响应式设计 Hook
 * 提供屏幕尺寸检测和响应式工具
 */
export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  });

  // 更新窗口尺寸
  const updateSize = useCallback(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  // 监听窗口尺寸变化
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 防抖处理
    let timeoutId: NodeJS.Timeout;
    const debouncedUpdateSize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateSize, 100);
    };

    window.addEventListener("resize", debouncedUpdateSize);
    
    // 初始化
    updateSize();

    return () => {
      window.removeEventListener("resize", debouncedUpdateSize);
      clearTimeout(timeoutId);
    };
  }, [updateSize]);

  // 当前屏幕尺寸
  const screenSize = useMemo((): ScreenSize => {
    const { width } = windowSize;
    
    if (width >= breakpoints["2xl"]) return "2xl";
    if (width >= breakpoints.xl) return "xl";
    if (width >= breakpoints.lg) return "lg";
    if (width >= breakpoints.md) return "md";
    if (width >= breakpoints.sm) return "sm";
    return "xs";
  }, [windowSize]);

  // 检查是否匹配特定断点
  const isBreakpoint = useCallback((breakpoint: Breakpoint) => {
    return windowSize.width >= breakpoints[breakpoint];
  }, [windowSize.width]);

  // 检查是否在断点范围内
  const isBetween = useCallback((min: Breakpoint, max: Breakpoint) => {
    return windowSize.width >= breakpoints[min] && windowSize.width < breakpoints[max];
  }, [windowSize.width]);

  // 检查是否为移动设备
  const isMobile = useMemo(() => {
    return screenSize === "xs" || screenSize === "sm";
  }, [screenSize]);

  // 检查是否为平板设备
  const isTablet = useMemo(() => {
    return screenSize === "md";
  }, [screenSize]);

  // 检查是否为桌面设备
  const isDesktop = useMemo(() => {
    return screenSize === "lg" || screenSize === "xl" || screenSize === "2xl";
  }, [screenSize]);

  // 获取响应式值
  const getResponsiveValue = useCallback(<T>(values: Partial<Record<ScreenSize, T>>): T | undefined => {
    // 按优先级查找值
    const priorities: ScreenSize[] = [screenSize, "xl", "lg", "md", "sm", "xs"];
    
    for (const size of priorities) {
      if (values[size] !== undefined) {
        return values[size];
      }
    }
    
    return undefined;
  }, [screenSize]);

  // 获取网格列数
  const getGridCols = useCallback((config: Partial<Record<ScreenSize, number>>) => {
    return getResponsiveValue(config) || 1;
  }, [getResponsiveValue]);

  // 获取容器最大宽度
  const getMaxWidth = useCallback(() => {
    const maxWidths: Record<ScreenSize, string> = {
      xs: "100%",
      sm: "640px",
      md: "768px", 
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    };
    
    return maxWidths[screenSize];
  }, [screenSize]);

  // 获取侧边栏宽度
  const getSidebarWidth = useCallback(() => {
    if (isMobile) return "100%";
    if (isTablet) return "280px";
    return "320px";
  }, [isMobile, isTablet]);

  // 检查是否应该折叠侧边栏
  const shouldCollapseSidebar = useMemo(() => {
    return isMobile || isTablet;
  }, [isMobile, isTablet]);

  return {
    // 窗口信息
    windowSize,
    screenSize,
    
    // 设备类型检查
    isMobile,
    isTablet,
    isDesktop,
    
    // 断点检查
    isBreakpoint,
    isBetween,
    
    // 响应式工具
    getResponsiveValue,
    getGridCols,
    getMaxWidth,
    getSidebarWidth,
    shouldCollapseSidebar,
    
    // 便捷检查
    isXs: screenSize === "xs",
    isSm: screenSize === "sm",
    isMd: screenSize === "md",
    isLg: screenSize === "lg",
    isXl: screenSize === "xl",
    is2Xl: screenSize === "2xl",
    
    // 断点值
    breakpoints,
  };
}

/**
 * 媒体查询 Hook
 * 用于检查特定的媒体查询
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    
    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}

/**
 * 容器查询 Hook
 * 用于基于容器尺寸的响应式设计
 */
export function useContainerQuery(containerRef: React.RefObject<HTMLElement>) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // 基于容器宽度的响应式检查
  const isContainerSmall = containerSize.width < 400;
  const isContainerMedium = containerSize.width >= 400 && containerSize.width < 800;
  const isContainerLarge = containerSize.width >= 800;

  return {
    containerSize,
    isContainerSmall,
    isContainerMedium,
    isContainerLarge,
  };
}