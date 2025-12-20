import React, { useState, useEffect } from "react";
import { Minus, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/utils/tailwind";

interface TitleBarProps {
  title?: React.ReactNode;
  className?: string;
}

export function TitleBar({ title: _title = "Starepo", className }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [_isHovered, setIsHovered] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(false);

  // 检测平台
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        // 通过 userAgent 检测 Mac 平台
        const isMacPlatform = navigator.userAgent.includes('Mac');
        setIsMac(isMacPlatform);
      } catch (error) {
        console.error('Failed to detect platform:', error);
      }
    };
    checkPlatform();
  }, []);

  // 检查当前窗口状态
  useEffect(() => {
    // 这里可以添加检查窗口状态的逻辑
    // 暂时使用默认状态
  }, []);

  const handleMinimize = async () => {
    try {
      await window.electronAPI.window.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const result = await window.electronAPI.window.toggleMaximize();
      if (result.success && result.data) {
        setIsMaximized(result.data.isMaximized);
      }
    } catch (error) {
      console.error('Failed to toggle maximize window:', error);
    }
  };

  const handleClose = async () => {
    try {
      await window.electronAPI.window.close();
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <div
      className={cn(
        "flex h-10 w-full items-center justify-between bg-muted/30",
        "select-none", // 防止文本选择
        className
      )}
      style={{
        // 使整个标题栏可拖拽（除了按钮区域）
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      {/* 左侧：页面标题 */}
      <div
        className={cn(
          "flex items-center",
          isMac ? "pl-20 pr-3" : "px-3" // Mac 平台为交通灯按钮预留空间
        )}
        style={{
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties}
      >
        {_title && (
          typeof _title === 'string' ? (
            <h1 className="text-sm font-semibold text-foreground">{_title}</h1>
          ) : _title
        )}
      </div>

      {/* 中间：可拖拽区域 */}
      <div className="flex-1" />

      {/* 右侧：窗口控制按钮 (仅在非 Mac 平台显示) */}
      {!isMac && (
        <div
          className="flex"
          style={{
            // 按钮区域不可拖拽
            WebkitAppRegion: "no-drag",
          } as React.CSSProperties}
        >
          {/* 最小化按钮 */}
          <button
            onClick={handleMinimize}
            onMouseEnter={() => setIsHovered('minimize')}
            onMouseLeave={() => setIsHovered(null)}
            className={cn(
              "flex h-8 w-12 items-center justify-center transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-0"
            )}
            aria-label="最小化窗口"
          >
            <Minus className="h-3 w-3" />
          </button>

          {/* 最大化/还原按钮 */}
          <button
            onClick={handleMaximize}
            onMouseEnter={() => setIsHovered('maximize')}
            onMouseLeave={() => setIsHovered(null)}
            className={cn(
              "flex h-8 w-12 items-center justify-center transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-0"
            )}
            aria-label={isMaximized ? "还原窗口" : "最大化窗口"}
          >
            {isMaximized ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </button>

          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            onMouseEnter={() => setIsHovered('close')}
            onMouseLeave={() => setIsHovered(null)}
            className={cn(
              "flex h-8 w-12 items-center justify-center transition-colors",
              "hover:bg-destructive hover:text-destructive-foreground",
              "focus:outline-none focus:ring-0"
            )}
            aria-label="关闭窗口"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TitleBar;