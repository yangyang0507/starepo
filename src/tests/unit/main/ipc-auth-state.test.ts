/**
 * IPC认证合约测试 - get-auth-state
 * 测试获取认证状态的IPC通信合约
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { AUTH_IPC_CHANNELS } from '@shared/types/auth';
import { registerAuthIPCHandlers, unregisterAuthIPCHandlers } from '../../../main/ipc/auth-ipc-handlers';
import type {
  GetAuthStateRequest,
  GetAuthStateResponse,
  AuthState
} from '@shared/types/auth';

// Mock Electron IPC
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// Mock enhanced GitHub auth service
vi.mock('../../../main/services/github/enhanced-auth-service', () => ({
  enhancedGitHubAuthService: {
    getAuthState: vi.fn(),
  },
}));

describe('IPC Auth Contract: get-auth-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理之前注册的处理器
    unregisterAuthIPCHandlers();
  });

  it('should register IPC handler for get-auth-state', () => {
    // 注册IPC处理器
    registerAuthIPCHandlers();
    
    // 验证处理器被正确注册
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AUTH_IPC_CHANNELS.GET_AUTH_STATE,
      expect.any(Function)
    );
  });

  it('should return authenticated state when user is logged in', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    // Mock已认证状态响应
    const mockAuthState = {
      isAuthenticated: true,
      user: {
        id: 12345,
        login: 'testuser',
        html_url: 'https://github.com/testuser',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        name: 'Test User',
        email: 'test@example.com',
        public_repos: 10,
        followers: 5,
        following: 8,
      },
      tokenInfo: {
        scopes: ['repo', 'user'],
        tokenType: 'personal' as const,
        createdAt: new Date('2025-01-01'),
        lastUsed: new Date(),
      },
      lastValidated: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90天后
    };

    (enhancedGitHubAuthService.getAuthState as any).mockResolvedValue(mockAuthState);

    // 模拟请求（无参数）
    const request: GetAuthStateRequest = {};

    // 注册IPC处理器
    registerAuthIPCHandlers();
    
    // 获取注册的处理器
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authStateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.GET_AUTH_STATE
    )?.[1];

    expect(authStateHandler).toBeDefined();

    // 调用处理器
    const result = await authStateHandler(null, request);

    // 验证结果
    expect(result.authState.isAuthenticated).toBe(true);
    expect(result.authState.user).toBeDefined();
    expect(result.authState.tokenInfo).toBeDefined();
  });

  it('should return unauthenticated state when user is not logged in', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    (enhancedGitHubAuthService.getAuthState as any).mockResolvedValue({
      isAuthenticated: false,
    });

    const request: GetAuthStateRequest = {};

    registerAuthIPCHandlers();
    
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authStateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.GET_AUTH_STATE
    )?.[1];

    const result = await authStateHandler(null, request);
    expect(result.authState.isAuthenticated).toBe(false);
    expect(result.authState.user).toBeUndefined();
    expect(result.authState.tokenInfo).toBeUndefined();
  });

  it('should handle errors during state retrieval', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    (enhancedGitHubAuthService.getAuthState as any).mockRejectedValue(
      new Error('Storage access failed')
    );

    const request: GetAuthStateRequest = {};

    registerAuthIPCHandlers();
    
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authStateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.GET_AUTH_STATE
    )?.[1];

    const result = await authStateHandler(null, request);
    expect(result.authState.isAuthenticated).toBe(false);
  });
});
