import { useState } from "react";
import { windowAPI } from "@/services/api";

/**
 * 窗口控制 Hook
 * 提供窗口控制功能
 */
export function useWindow() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWindowAction = async (action: () => Promise<unknown>) => {
    try {
      setIsLoading(true);
      setError(null);
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Window action failed");
      console.error("Window action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const minimize = () => handleWindowAction(() => windowAPI.minimize());
  const maximize = () => handleWindowAction(() => windowAPI.maximize());
  const close = () => handleWindowAction(() => windowAPI.close());
  const toggleMaximize = () =>
    handleWindowAction(() => windowAPI.toggleMaximize());

  const setFullscreen = (fullscreen: boolean) =>
    handleWindowAction(() => windowAPI.setFullscreen(fullscreen));

  return {
    minimize,
    maximize,
    close,
    toggleMaximize,
    setFullscreen,
    isLoading,
    error,
  };
}
