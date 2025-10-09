import { ipcMain } from "electron";
import {
  secureStorageService,
  githubTokenStorage,
} from "../services/database/secure-service";
import { getLogger } from "../utils/logger";

const secureStorageLogger = getLogger("ipc:secure-storage");

// 安全存储相关的 IPC 通道
export const SECURE_STORAGE_CHANNELS = {
  // GitHub Token 相关
  SAVE_GITHUB_TOKEN: "secure-storage:save-github-token",
  GET_GITHUB_TOKEN: "secure-storage:get-github-token",
  SAVE_USER_INFO: "secure-storage:save-user-info",
  GET_USER_INFO: "secure-storage:get-user-info",
  GET_AUTH_METHOD: "secure-storage:get-auth-method",
  HAS_VALID_AUTH: "secure-storage:has-valid-auth",
  CLEAR_AUTH: "secure-storage:clear-auth",

  // 通用安全存储
  SET_ITEM: "secure-storage:set-item",
  GET_ITEM: "secure-storage:get-item",
  REMOVE_ITEM: "secure-storage:remove-item",
  HAS_ITEM: "secure-storage:has-item",
  GET_ALL_KEYS: "secure-storage:get-all-keys",
  CLEAR_ALL: "secure-storage:clear-all",
  GET_STATS: "secure-storage:get-stats",

  // 系统检查
  IS_ENCRYPTION_AVAILABLE: "secure-storage:is-encryption-available",
} as const;

export function setupSecureStorageHandlers(): void {
  // GitHub Token 相关处理器
  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.SAVE_GITHUB_TOKEN,
    async (event, token: string, authMethod: "token") => {
      try {
        await githubTokenStorage.saveToken(token, authMethod);
        return { success: true };
      } catch (error) {
        secureStorageLogger.error("保存 GitHub Token 失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(SECURE_STORAGE_CHANNELS.GET_GITHUB_TOKEN, async () => {
    try {
      const token = await githubTokenStorage.getToken();
      return { success: true, data: token };
    } catch (error) {
      secureStorageLogger.error("获取 GitHub Token 失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.SAVE_USER_INFO,
    async (event, userInfo: import("@shared/types").GitHubUser) => {
      try {
        await githubTokenStorage.saveUserInfo(userInfo);
        return { success: true };
      } catch (error) {
        secureStorageLogger.error("保存用户信息失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(SECURE_STORAGE_CHANNELS.GET_USER_INFO, async () => {
    try {
      const userInfo = await githubTokenStorage.getUserInfo();
      return { success: true, data: userInfo };
    } catch (error) {
      secureStorageLogger.error("获取用户信息失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(SECURE_STORAGE_CHANNELS.GET_AUTH_METHOD, async () => {
    try {
      const authMethod = await githubTokenStorage.getAuthMethod();
      return { success: true, data: authMethod };
    } catch (error) {
      secureStorageLogger.error("获取认证方式失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(SECURE_STORAGE_CHANNELS.HAS_VALID_AUTH, async () => {
    try {
      const hasAuth = await githubTokenStorage.hasValidAuth();
      return { success: true, data: hasAuth };
    } catch (error) {
      secureStorageLogger.error("检查认证状态失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(SECURE_STORAGE_CHANNELS.CLEAR_AUTH, async () => {
    try {
      await githubTokenStorage.clearAuth();
      return { success: true };
    } catch (error) {
      secureStorageLogger.error("清除认证信息失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 通用安全存储处理器
  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.SET_ITEM,
    async (event, key: string, value: string, expiresIn?: number) => {
      try {
        await secureStorageService.setItem(key, value, expiresIn);
        return { success: true };
      } catch (error) {
        secureStorageLogger.error(`设置存储项目失败 (${key})`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.GET_ITEM,
    async (event, key: string) => {
      try {
        const value = await secureStorageService.getItem(key);
        return { success: true, data: value };
      } catch (error) {
        secureStorageLogger.error(`获取存储项目失败 (${key})`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.REMOVE_ITEM,
    async (event, key: string) => {
      try {
        await secureStorageService.removeItem(key);
        return { success: true };
      } catch (error) {
        secureStorageLogger.error(`删除存储项目失败 (${key})`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(
    SECURE_STORAGE_CHANNELS.HAS_ITEM,
    async (event, key: string) => {
      try {
        const hasItem = await secureStorageService.hasItem(key);
        return { success: true, data: hasItem };
      } catch (error) {
        secureStorageLogger.error(`检查存储项目失败 (${key})`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle(SECURE_STORAGE_CHANNELS.GET_ALL_KEYS, async () => {
    try {
      const keys = await secureStorageService.getAllKeys();
      return { success: true, data: keys };
    } catch (error) {
      secureStorageLogger.error("获取所有存储键失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(SECURE_STORAGE_CHANNELS.CLEAR_ALL, async () => {
    try {
      await secureStorageService.clear();
      return { success: true };
    } catch (error) {
      secureStorageLogger.error("清空所有存储失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(SECURE_STORAGE_CHANNELS.GET_STATS, async () => {
    try {
      const stats = await secureStorageService.getStorageStats();
      return { success: true, data: stats };
    } catch (error) {
      secureStorageLogger.error("获取存储统计失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 系统检查
  ipcMain.handle(SECURE_STORAGE_CHANNELS.IS_ENCRYPTION_AVAILABLE, async () => {
    try {
      const { safeStorage } = await import("electron");
      const isAvailable =
        secureStorageService.constructor.name === "SecureStorageService"
          ? safeStorage.isEncryptionAvailable()
          : false;
      return { success: true, data: isAvailable };
    } catch (error) {
      secureStorageLogger.error("检查加密可用性失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  secureStorageLogger.info("安全存储 IPC 处理器已设置");
}

// 清理处理器
export function cleanupSecureStorageHandlers(): void {
  Object.values(SECURE_STORAGE_CHANNELS).forEach((channel) => {
    ipcMain.removeAllListeners(channel);
  });
  secureStorageLogger.info("安全存储 IPC 处理器已清理");
}
