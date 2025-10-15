/**
 * IPC认证合约测试 - authenticate-with-token
 * 测试IPC通信合约的正确性和实现
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import { AUTH_IPC_CHANNELS } from '@shared/types/auth';
import { registerAuthIPCHandlers, unregisterAuthIPCHandlers } from '../../../main/ipc/auth-ipc-handlers';
import type {
  AuthenticateWithTokenRequest,
  AuthenticateWithTokenResponse
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
    authenticateWithToken: vi.fn(),
    getAuthState: vi.fn(),
    refreshAuth: vi.fn(),
    validateToken: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

describe('IPC Auth Contract: authenticate-with-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理之前注册的处理器
    unregisterAuthIPCHandlers();
  });

  it('should register IPC handler for authenticate-with-token', () => {
    // 注册IPC处理器
    registerAuthIPCHandlers();
    
    // 验证处理器被正确注册
    expect(ipcMain.handle).toHaveBeenCalledWith(
      AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN,
      expect.any(Function)
    );
  });

  it('should handle valid token authentication request', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    // Mock成功的认证响应
    (enhancedGitHubAuthService.authenticateWithToken as any).mockResolvedValue({
      success: true,
      user: {
        login: 'testuser',
        id: 123,
        name: 'Test User',
      },
    });

    // 模拟有效的请求
    const validRequest: AuthenticateWithTokenRequest = {
      token: 'github_pat_valid_token_example',
    };

    // 注册IPC处理器
    registerAuthIPCHandlers();
    
    // 获取注册的处理器
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authenticateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN
    )?.[1];

    expect(authenticateHandler).toBeDefined();

    // 调用处理器
    const result = await authenticateHandler(null, validRequest);

    // 验证结果
    expect(result).toEqual({
      success: true,
      user: {
        login: 'testuser',
        id: 123,
        name: 'Test User',
      },
    });

    // 验证服务被正确调用
    expect(enhancedGitHubAuthService.authenticateWithToken).toHaveBeenCalledWith(
      validRequest.token
    );
  });

  it('should handle invalid token authentication request', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    // Mock失败的认证响应
    (enhancedGitHubAuthService.authenticateWithToken as any).mockResolvedValue({
      success: false,
      error: 'Invalid token format or expired token',
    });

    // 模拟无效的请求
    const invalidRequest: AuthenticateWithTokenRequest = {
      token: 'invalid_token',
    };

    // 注册IPC处理器
    registerAuthIPCHandlers();
    
    // 获取注册的处理器
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authenticateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN
    )?.[1];

    expect(authenticateHandler).toBeDefined();

    // 调用处理器
    const result = await authenticateHandler(null, invalidRequest);

    // 验证结果
    expect(result).toEqual({
      success: false,
      error: 'Invalid token format or expired token',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle empty token request', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    // Mock空token认证失败响应
    (enhancedGitHubAuthService.authenticateWithToken as any).mockResolvedValue({
      success: false,
      error: 'Token is required',
    });

    const emptyRequest: AuthenticateWithTokenRequest = {
      token: '',
    };

    registerAuthIPCHandlers();
    
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authenticateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN
    )?.[1];

    const result = await authenticateHandler(null, emptyRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should handle network errors during authentication', async () => {
    const { enhancedGitHubAuthService } = await import('../../../main/services/github/enhanced-auth-service');
    
    // Mock网络错误
    (enhancedGitHubAuthService.authenticateWithToken as any).mockRejectedValue(
      new Error('Network error: Unable to reach GitHub API')
    );

    const validRequest: AuthenticateWithTokenRequest = {
      token: 'github_pat_valid_token_example',
    };

    registerAuthIPCHandlers();
    
    const handleCalls = (ipcMain.handle as any).mock.calls;
    const authenticateHandler = handleCalls.find(
      (call: any) => call[0] === AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN
    )?.[1];

    const result = await authenticateHandler(null, validRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('should validate request type safety', () => {
    // 验证类型安全性
    const request: AuthenticateWithTokenRequest = {
      token: 'test_token',
    };

    // TypeScript应该确保请求包含必需的字段
    expect(request.token).toBeDefined();
    expect(typeof request.token).toBe('string');
  });

  it('should validate response type safety', () => {
    // 验证响应类型安全性
    const successResponse: AuthenticateWithTokenResponse = {
      success: true,
    };

    const errorResponse: AuthenticateWithTokenResponse = {
      success: false,
      error: 'Test error',
    };

    // TypeScript应该确保响应格式正确
    expect(typeof successResponse.success).toBe('boolean');
    expect(typeof errorResponse.success).toBe('boolean');
    expect(typeof errorResponse.error).toBe('string');
  });
});