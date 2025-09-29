import { ipcMain } from 'electron';
import { enhancedGitHubAuthService } from '../services/github/enhanced-auth-service';
import { AUTH_IPC_CHANNELS } from '@shared/types/auth';
import type {
  AuthenticateWithTokenRequest,
  AuthenticateWithTokenResponse,
  GetAuthStateRequest,
  GetAuthStateResponse,
  RefreshAuthRequest,
  RefreshAuthResponse,
  ClearAuthRequest,
  ClearAuthResponse,
} from '@shared/types/auth';

/**
 * 注册新的认证IPC处理器
 * 使用新的AUTH_IPC_CHANNELS和类型定义
 */
export function registerAuthIPCHandlers(): void {
  // authenticate-with-token
  ipcMain.handle(
    AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN,
    async (_, request: AuthenticateWithTokenRequest): Promise<AuthenticateWithTokenResponse> => {
      try {
        const result = await enhancedGitHubAuthService.authenticateWithToken(request.token);

        if (result.success) {
          return {
            success: true,
            user: result.user,
          };
        } else {
          return {
            success: false,
            error: result.error || 'Authentication failed',
          };
        }
      } catch (error) {
        console.error('IPC authenticate-with-token error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown authentication error',
        };
      }
    }
  );

  // get-auth-state
  ipcMain.handle(
    AUTH_IPC_CHANNELS.GET_AUTH_STATE,
    async (_, _request: GetAuthStateRequest): Promise<GetAuthStateResponse> => {
      try {
        const authState = await enhancedGitHubAuthService.getAuthState();
        return {
          authState,
        };
      } catch (error) {
        console.error('IPC get-auth-state error:', error);
        // 返回未认证状态作为fallback
        return {
          authState: {
            isAuthenticated: false,
          },
        };
      }
    }
  );

  // refresh-auth
  ipcMain.handle(
    AUTH_IPC_CHANNELS.REFRESH_AUTH,
    async (_, _request: RefreshAuthRequest): Promise<RefreshAuthResponse> => {
      try {
        const success = await enhancedGitHubAuthService.refreshAuth();

        if (success) {
          return {
            success: true,
          };
        } else {
          return {
            success: false,
            error: 'Authentication refresh failed',
          };
        }
      } catch (error) {
        console.error('IPC refresh-auth error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown refresh error',
        };
      }
    }
  );

  // clear-auth
  ipcMain.handle(
    AUTH_IPC_CHANNELS.CLEAR_AUTH,
    async (_, _request: ClearAuthRequest): Promise<ClearAuthResponse> => {
      try {
        await enhancedGitHubAuthService.clearAuth();
        return {
          success: true,
        };
      } catch (error) {
        console.error('IPC clear-auth error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear authentication',
        };
      }
    }
  );

  console.log('Enhanced Auth IPC handlers registered');
}

/**
 * 移除认证IPC处理器
 */
export function unregisterAuthIPCHandlers(): void {
  ipcMain.removeHandler(AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN);
  ipcMain.removeHandler(AUTH_IPC_CHANNELS.GET_AUTH_STATE);
  ipcMain.removeHandler(AUTH_IPC_CHANNELS.REFRESH_AUTH);
  ipcMain.removeHandler(AUTH_IPC_CHANNELS.CLEAR_AUTH);

  console.log('Enhanced Auth IPC handlers unregistered');
}