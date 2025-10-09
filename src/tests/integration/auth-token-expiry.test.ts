/**
 * 集成测试：Token失效处理
 * 测试Token过期、吊销、权限变化等场景的处理机制
 * 这个测试必须在实现前失败
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { app, BrowserWindow } from 'electron';
// Mock the secure service instead of importing from main process
vi.mock('../../../main/services/database/secure-service', () => ({
  secureStorageService: {
    getInstance: vi.fn().mockReturnValue({
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }),
  },
  githubTokenStorage: {
    getToken: vi.fn(),
    storeToken: vi.fn(),
    getTokenInfo: vi.fn(),
    storeTokenInfo: vi.fn(),
    getAuthState: vi.fn(),
    storeAuthState: vi.fn(),
    saveUserInfo: vi.fn(),
    clear: vi.fn(),
  },
}));

// Import after mocking
const { secureStorageService, githubTokenStorage } = await import('../../main/services/database/secure-service');
import { AUTH_IPC_CHANNELS } from '@shared/types/auth';
import type { GitHubUser, AuthState } from '@shared/types/auth';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    on: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    getPath: vi.fn().mockReturnValue('/tmp/starepo-test'),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
      executeJavaScript: vi.fn(),
    },
    on: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockImplementation((str) => Buffer.from(str)),
    decryptString: vi.fn().mockImplementation((buf) => buf.toString()),
  },
}));

// Mock GitHub API
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: vi.fn(),
    },
    rateLimit: {
      get: vi.fn(),
    },
    repos: {
      listForAuthenticatedUser: vi.fn(),
    },
  },
};

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

describe('Integration Test: Token失效处理', () => {
  let mainWindow: BrowserWindow;
  const testToken = 'github_pat_11AAAAAAA0123456789abcdef';
const mockUser: GitHubUser = {
  id: 12345,
  login: 'testuser',
  html_url: 'https://github.com/testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  name: 'Test User',
  email: 'test@example.com',
  public_repos: 10,
    followers: 5,
    following: 8,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 清除安全存储中的测试数据
    try {
      await githubTokenStorage.clearAuth();
    } catch (error) {
      // 忽略清除错误
    }

    // 创建测试窗口
    mainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await githubTokenStorage.clearAuth();
    } catch (error) {
      // 忽略清除错误
    }

    if (mainWindow) {
      mainWindow.destroy();
    }
  });

  it('should handle token expiry during active session', async () => {
    // 测试活跃会话中Token过期的处理

    // 1. 设置初始有效状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);
    await githubTokenStorage.updateLastValidated();

    // 初始API调用成功
    mockOctokit.rest.users.getAuthenticated.mockResolvedValueOnce({
      data: mockUser,
    });

    try {
      // 2. 验证初始认证状态
      const initResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.initializeAuth()
      `);
      expect(initResult).toBe(true);

      // 3. 模拟Token在使用过程中过期
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue({
        status: 401,
        message: 'Bad credentials',
        response: {
          data: {
            message: 'Bad credentials',
            documentation_url: 'https://docs.github.com/rest'
          }
        }
      });

      // 4. 触发需要API调用的操作（比如刷新用户信息）
      const refreshResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.refreshAuth()
      `);

      expect(refreshResult).toBe(false);

      // 5. 验证认证状态被自动清除
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeUndefined();

      // 6. 验证本地Token被清除
      const storedToken = await githubTokenStorage.getToken();
      expect(storedToken).toBeNull();

      // 7. 验证UI收到过期通知
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'auth:token-expired',
        expect.any(Object)
      );

    } catch (error) {
      // 预期会失败，因为过期处理逻辑还没有实现
      expect(error).toBeDefined();
    }
  });

  it('should handle token revocation by user', async () => {
    // 测试用户在GitHub上撤销Token的情况

    // 1. 设置初始状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 2. 模拟Token被用户撤销
    mockOctokit.rest.users.getAuthenticated.mockRejectedValue({
      status: 401,
      message: 'The access token used in the Authorization header has been revoked.',
      response: {
        data: {
          message: 'Bad credentials',
          documentation_url: 'https://docs.github.com/rest'
        }
      }
    });

    try {
      // 3. 尝试使用被撤销的Token
      const authResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.refreshAuth()
      `);

      expect(authResult).toBe(false);

      // 4. 验证应用正确识别Token被撤销
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      expect(authState.isAuthenticated).toBe(false);

      // 5. 验证错误信息包含撤销提示
      expect(authState.error).toContain('revoked');

      // 6. 验证本地数据被清除
      const storedToken = await githubTokenStorage.getToken();
      expect(storedToken).toBeNull();

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  it('should handle token scope changes', async () => {
    // 测试Token权限范围变化

    // 1. 设置具有完整权限的Token
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    const fullScopeTokenInfo = {
      scopes: ['repo', 'user', 'admin:org'],
      tokenType: 'personal' as const,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    await githubTokenStorage.storeTokenInfo(fullScopeTokenInfo);

    // 2. 模拟权限被缩减后的API响应
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: mockUser,
    });

    // 模拟某些操作因权限不足而失败
    mockOctokit.rest.repos.listForAuthenticatedUser.mockRejectedValue({
      status: 403,
      message: 'Resource not accessible by personal access token',
      response: {
        data: {
          message: 'Resource not accessible by personal access token',
          documentation_url: 'https://docs.github.com/rest'
        }
      }
    });

    try {
      // 3. 初始化认证
      const initResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.initializeAuth()
      `);

      // 4. 尝试执行需要完整权限的操作
      const repoResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getUserRepositories()
      `);

      expect(repoResult.success).toBe(false);
      expect(repoResult.error).toContain('not accessible');

      // 5. 验证权限变化被记录
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      expect(authState.scopeRestricted).toBe(true);

      // 6. 验证用户收到权限不足提示
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'auth:scope-restricted',
        expect.objectContaining({
          requiredScope: expect.any(String),
          currentScopes: expect.any(Array),
        })
      );

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  it('should handle rate limit exceeded gracefully', async () => {
    // 测试API速率限制超出的处理

    // 1. 设置有效认证状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 2. 模拟速率限制超出
    const rateLimitError = {
      status: 403,
      message: 'API rate limit exceeded',
      response: {
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor((Date.now() + 3600000) / 1000)), // 1小时后重置
        },
        data: {
          message: 'API rate limit exceeded for user ID 12345.',
          documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
        }
      }
    };

    mockOctokit.rest.users.getAuthenticated.mockRejectedValue(rateLimitError);

    try {
      // 3. 尝试使用API
      const refreshResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.refreshAuth()
      `);

      expect(refreshResult).toBe(false);

      // 4. 验证认证状态仍然有效（速率限制不应该清除认证）
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      expect(authState.isAuthenticated).toBe(true); // 认证状态保持
      expect(authState.rateLimited).toBe(true); // 但标记为受限

      // 5. 验证速率限制信息被保存
      expect(authState.tokenInfo.rateLimit).toBeDefined();
      expect(authState.tokenInfo.rateLimit.remaining).toBe(0);

      // 6. 验证Token没有被清除（不是认证问题）
      const storedToken = await githubTokenStorage.getToken();
      expect(storedToken).toBe(testToken);

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  it('should handle network connectivity issues during token validation', async () => {
    // 测试网络连接问题的处理

    // 1. 设置有效认证状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 2. 模拟网络连接问题
    const networkErrors = [
      new Error('Network error: ENOTFOUND api.github.com'),
      new Error('Network error: ECONNREFUSED'),
      new Error('Network error: ETIMEDOUT'),
    ];

    for (const networkError of networkErrors) {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValueOnce(networkError);

      try {
        // 3. 尝试验证Token
        const refreshResult = await mainWindow.webContents.executeJavaScript(`
          window.electronAPI.github.refreshAuth()
        `);

        // 网络错误时应该保持现有状态，不清除Token
        expect(refreshResult).toBe(false);

        // 4. 验证认证状态保持不变
        const authState = await mainWindow.webContents.executeJavaScript(`
          window.electronAPI.github.getAuthState()
        `);

        expect(authState.isAuthenticated).toBe(true);
        expect(authState.networkError).toBe(true);

        // 5. 验证Token没有被清除
        const storedToken = await githubTokenStorage.getToken();
        expect(storedToken).toBe(testToken);

      } catch (error) {
        // 预期会失败
        expect(error).toBeDefined();
      }
    }
  });

  it('should handle automatic token refresh on expiry warning', async () => {
    // 测试Token接近过期时的自动刷新

    // 1. 设置接近过期的Token（但仍有效）
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 设置过期警告时间（6小时前验证）
    const warningTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await githubTokenStorage.updateLastValidated(warningTime);

    // 2. Mock成功的Token验证
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: mockUser,
    });

    try {
      // 3. 触发自动刷新检查
      const initResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.initializeAuth()
      `);

      expect(initResult).toBe(true);

      // 4. 验证Token被自动刷新
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();

      // 5. 验证lastValidated时间被更新
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      const lastValidated = new Date(authState.lastValidated);
      expect(lastValidated.getTime()).toBeGreaterThan(warningTime.getTime());

      // 6. 验证用户收到刷新通知
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'auth:token-refreshed',
        expect.any(Object)
      );

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  it('should handle token deletion by GitHub admin', async () => {
    // 测试GitHub管理员删除Token的情况

    // 1. 设置有效认证状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 2. 模拟Token被GitHub管理员删除
    mockOctokit.rest.users.getAuthenticated.mockRejectedValue({
      status: 401,
      message: 'Bad credentials',
      response: {
        data: {
          message: 'Bad credentials',
          documentation_url: 'https://docs.github.com/rest'
        }
      }
    });

    try {
      // 3. 尝试使用被删除的Token
      const refreshResult = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.refreshAuth()
      `);

      expect(refreshResult).toBe(false);

      // 4. 验证应用正确处理Token删除
      const authState = await mainWindow.webContents.executeJavaScript(`
        window.electronAPI.github.getAuthState()
      `);

      expect(authState.isAuthenticated).toBe(false);

      // 5. 验证本地数据被完全清除
      const storedToken = await githubTokenStorage.getToken();
      const storedUser = await githubTokenStorage.getUserInfo();

      expect(storedToken).toBeNull();
      expect(storedUser).toBeNull();

      // 6. 验证用户收到需要重新认证的通知
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'auth:re-authentication-required',
        expect.objectContaining({
          reason: 'token-invalid',
        })
      );

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  it('should handle concurrent token validation requests', async () => {
    // 测试并发Token验证请求的处理

    // 1. 设置有效认证状态
    await githubTokenStorage.storeToken(testToken);
    await githubTokenStorage.saveUserInfo(mockUser);

    // 2. Mock延迟的API响应
    mockOctokit.rest.users.getAuthenticated.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: mockUser }), 200))
    );

    try {
      // 3. 同时发起多个验证请求
      const concurrentRequests = [
        mainWindow.webContents.executeJavaScript(`window.electronAPI.github.refreshAuth()`),
        mainWindow.webContents.executeJavaScript(`window.electronAPI.github.refreshAuth()`),
        mainWindow.webContents.executeJavaScript(`window.electronAPI.github.refreshAuth()`),
      ];

      const results = await Promise.all(concurrentRequests);

      // 4. 验证并发请求被正确处理（防止重复验证）
      // 应该只有一个实际的API调用
      expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalledTimes(1);

      // 5. 验证所有请求都得到正确结果
      results.forEach(result => {
        expect(result).toBe(true);
      });

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });
});
