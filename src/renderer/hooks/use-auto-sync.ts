import { useEffect } from "react";
import { settingsAPI } from "@/api/settings";
import { useRepositoryStore } from "@/stores/repository-store";

type AutoSyncConfig = {
  enabled: boolean;
  intervalMinutes: number;
};

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 1440;

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let currentConfig: AutoSyncConfig = {
  enabled: false,
  intervalMinutes: 15,
};
let lastSyncTimestamp = 0;

const sanitizeInterval = (minutes: number): number => {
  if (!Number.isFinite(minutes)) {
    return currentConfig.intervalMinutes;
  }
  const rounded = Math.floor(minutes);
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, rounded));
};

const clearTimer = () => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
};

const scheduleTimer = () => {
  clearTimer();
  if (!currentConfig.enabled) {
    return;
  }

  const intervalMs = currentConfig.intervalMinutes * 60 * 1000;
  autoSyncTimer = setInterval(() => {
    void runAutoSync("interval");
  }, intervalMs);
};

async function runAutoSync(reason: "initial" | "interval" | "manual"): Promise<void> {
  const { refreshData, syncing, loading, user, repositories } = useRepositoryStore.getState();

  if (!currentConfig.enabled) {
    return;
  }

  if (!user) {
    return;
  }

  if (loading || syncing) {
    return;
  }

  // 如果还未加载任何数据，等待首次初始化完成
  if (!repositories.length && reason !== "initial") {
    return;
  }

  const now = Date.now();
  if (reason === "interval" && now - lastSyncTimestamp < currentConfig.intervalMinutes * 30 * 1000) {
    // 避免在短时间内重复刷新
    return;
  }

  try {
    await refreshData();
    lastSyncTimestamp = now;
  } catch (error) {
    console.error(`[AutoSync] 自动同步失败 (${reason})`, error);
  }
}

export async function configureAutoSync(config: AutoSyncConfig, options: { immediate?: boolean } = {}): Promise<void> {
  currentConfig = {
    enabled: Boolean(config.enabled),
    intervalMinutes: sanitizeInterval(config.intervalMinutes),
  };

  scheduleTimer();

  if (currentConfig.enabled && options.immediate) {
    await runAutoSync("manual");
  }
}

export function stopAutoSync(): void {
  currentConfig = { ...currentConfig, enabled: false };
  clearTimer();
}

export async function triggerAutoSyncNow(): Promise<void> {
  await runAutoSync("manual");
}

export function useAutoSyncInitializer(): void {
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (cancelled) return;
        await configureAutoSync(
          {
            enabled: settings.autoSyncEnabled,
            intervalMinutes: settings.autoSyncIntervalMinutes,
          },
          { immediate: false },
        );
      } catch (error) {
        console.error("[AutoSync] 初始化失败", error);
      }
    };

    initialize();

    return () => {
      cancelled = true;
      stopAutoSync();
    };
  }, []);
}
