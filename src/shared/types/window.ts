/**
 * 窗口状态相关类型定义
 */

/**
 * 窗口状态
 */
export interface WindowState {
  isMaximized: boolean;
  isFullscreen: boolean;
  isMinimized: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
