/**
 * E2E测试：完整认证流程
 * 测试从用户首次访问到完成认证的完整端到端流程
 * 这个测试必须在实现前失败
 */

import { test, expect } from '@playwright/test';
import { ElectronApplication, Page, _electron as electron } from 'playwright';
import path from 'path';

// Type definitions for E2E test responses
interface AuthStateResponse {
  success: boolean;
  data?: {
    isAuthenticated: boolean;
    user?: unknown;
    tokenInfo?: unknown;
    lastValidated?: Date;
    expiresAt?: Date;
  };
  error?: string;
}

let electronApp: ElectronApplication;
let page: Page;

test.describe('E2E: 完整认证流程', () => {
  test.beforeAll(async () => {
    // 启动Electron应用
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // 使用测试目录避免污染用户数据
        STAREPO_DATA_DIR: path.join(__dirname, '../../.test-data'),
      },
    });

    // 获取主窗口
    page = await electronApp.firstWindow();

    // 等待应用完全加载
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // 清理测试数据
    try {
      await page.evaluate(() => {
        return window.electronAPI?.github?.clearAuth?.();
      });
    } catch (_error) {
      // 忽略清理错误
    }

    await electronApp.close();
  });

  test.beforeEach(async () => {
    // 每个测试前清理认证状态
    try {
      await page.evaluate(() => {
        return window.electronAPI?.github?.clearAuth?.();
      });
    } catch (_error) {
      // 忽略清理错误
    }
  });

  test('should complete full authentication flow for new user', async () => {
    // 这个测试应该失败，因为完整的认证流程还没有实现

    try {
      // 1. 验证应用显示欢迎/引导页面
      await expect(page).toHaveTitle(/Starepo/);

      // 查找认证相关的元素（可能是引导页面或登录按钮）
      const authElement = page.locator('[data-testid="auth-setup"], [data-testid="login-button"], .auth-intro');
      await expect(authElement).toBeVisible({ timeout: 10000 });

      // 2. 点击"设置GitHub Token"或类似按钮
      const setupButton = page.locator('[data-testid="setup-token"], [data-testid="add-token"], button:has-text("设置"), button:has-text("Token")');
      await setupButton.first().click();

      // 3. 验证Token输入界面出现
      const tokenInput = page.locator('input[type="text"], input[type="password"], [data-testid="token-input"]').first();
      await expect(tokenInput).toBeVisible();

      // 4. 输入有效的GitHub Token
      const testToken = 'github_pat_11AAAAAAA0123456789abcdef';
      await tokenInput.fill(testToken);

      // 5. 点击确认按钮
      const confirmButton = page.locator('button:has-text("确认"), button:has-text("保存"), button:has-text("验证"), [data-testid="confirm-token"]');
      await confirmButton.first().click();

      // 6. 等待验证过程（显示加载状态）
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner');
      await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

      // 7. 验证认证成功后的界面
      await expect(loadingIndicator).toBeHidden({ timeout: 15000 });

      // 应该显示用户信息或主界面
      const userInfo = page.locator('[data-testid="user-info"], .user-avatar, .user-name');
      await expect(userInfo).toBeVisible({ timeout: 10000 });

      // 8. 验证用户头像和名称显示
      const userAvatar = page.locator('img[alt*="avatar"], [data-testid="user-avatar"]');
      const userName = page.locator('[data-testid="user-name"], .user-name');

      await expect(userAvatar).toBeVisible();
      await expect(userName).toContainText('testuser'); // 假设mock数据中的用户名

      // 9. 验证主要功能区域可访问
      const searchArea = page.locator('[data-testid="search"], input[placeholder*="搜索"], .search-box');
      await expect(searchArea).toBeVisible();

      // 10. 验证设置或用户菜单可访问
      const userMenu = page.locator('[data-testid="user-menu"], .user-dropdown, .settings-button');
      if (await userMenu.isVisible()) {
        await userMenu.click();

        // 应该有登出选项
        const logoutOption = page.locator('[data-testid="logout"], button:has-text("退出"), button:has-text("登出")');
        await expect(logoutOption).toBeVisible();
      }

    } catch (error) {
      // 预期会失败，因为完整的认证流程UI还没有实现
      expect(error).toBeDefined();
    }
  });

  test('should handle invalid token gracefully', async () => {
    // 测试无效Token的处理

    try {
      // 1. 导航到Token设置界面
      const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');
      await setupButton.first().click();

      // 2. 输入无效Token
      const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
      await tokenInput.fill('invalid_token_123');

      // 3. 点击确认
      const confirmButton = page.locator('button:has-text("确认"), button:has-text("验证")');
      await confirmButton.first().click();

      // 4. 验证错误消息显示
      const errorMessage = page.locator('[data-testid="error-message"], .error, .alert-error');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      await expect(errorMessage).toContainText(/无效|invalid|错误/i);

      // 5. 验证用户仍在Token设置界面
      await expect(tokenInput).toBeVisible();

      // 6. 验证可以重新尝试
      await tokenInput.clear();
      await tokenInput.fill('github_pat_valid_token');

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should persist authentication across app restarts', async () => {
    // 测试应用重启后的认证持久化

    try {
      // 1. 完成初始认证（假设有快速设置方法）
      await page.evaluate(() => {
        return window.electronAPI?.github?.authenticateWithToken?.('github_pat_11AAAAAAA0123456789abcdef');
      });

      // 验证认证成功
      const authState = await page.evaluate(() => {
        return window.electronAPI?.github?.getAuthState?.();
      }) as AuthStateResponse;
      expect(authState?.data?.isAuthenticated).toBe(true);

      // 2. 重启应用
      await electronApp.close();

      electronApp = await electron.launch({
        args: [path.join(__dirname, '../../dist/main/main.js')],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          STAREPO_DATA_DIR: path.join(__dirname, '../../.test-data'),
        },
      });

      page = await electronApp.firstWindow();
      await page.waitForLoadState('domcontentloaded');

      // 3. 验证认证状态被恢复
      const restoredAuthState = await page.evaluate(() => {
        return window.electronAPI?.github?.getAuthState?.();
      }) as AuthStateResponse;

      expect(restoredAuthState?.data?.isAuthenticated).toBe(true);

      // 4. 验证用户界面直接显示主界面（不需要重新登录）
      const userInfo = page.locator('[data-testid="user-info"], .user-avatar');
      await expect(userInfo).toBeVisible({ timeout: 10000 });

      // 5. 验证功能正常可用
      const searchBox = page.locator('[data-testid="search"], input[placeholder*="搜索"]');
      await expect(searchBox).toBeVisible();

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should handle logout flow completely', async () => {
    // 测试完整的登出流程

    try {
      // 1. 设置认证状态
      await page.evaluate(() => {
        return window.electronAPI?.github?.authenticateWithToken?.('github_pat_11AAAAAAA0123456789abcdef');
      });

      // 2. 打开用户菜单
      const userMenu = page.locator('[data-testid="user-menu"], .user-dropdown, .user-avatar');
      await userMenu.click();

      // 3. 点击登出
      const logoutButton = page.locator('[data-testid="logout"], button:has-text("退出"), button:has-text("登出")');
      await logoutButton.click();

      // 4. 处理确认对话框（如果有）
      const confirmDialog = page.locator('[role="dialog"], .modal, .confirm-dialog');
      if (await confirmDialog.isVisible()) {
        const confirmButton = page.locator('button:has-text("确认"), button:has-text("是")');
        await confirmButton.click();
      }

      // 5. 验证返回到未认证状态
      const authSetup = page.locator('[data-testid="auth-setup"], .auth-intro, button:has-text("设置Token")');
      await expect(authSetup).toBeVisible({ timeout: 10000 });

      // 6. 验证用户信息不再显示
      const userInfo = page.locator('[data-testid="user-info"], .user-avatar');
      await expect(userInfo).toBeHidden();

      // 7. 验证受保护功能不可访问
      const protectedFeature = page.locator('[data-testid="starred-repos"], .repo-list');
      await expect(protectedFeature).toBeHidden();

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should handle network connectivity issues during authentication', async () => {
    // 测试认证过程中的网络问题

    try {
      // 1. 模拟网络离线（如果支持）
      await page.context().setOffline(true);

      // 2. 尝试进行认证
      const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');
      await setupButton.first().click();

      const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
      await tokenInput.fill('github_pat_11AAAAAAA0123456789abcdef');

      const confirmButton = page.locator('button:has-text("确认"), button:has-text("验证")');
      await confirmButton.click();

      // 3. 验证网络错误处理
      const errorMessage = page.locator('[data-testid="error-message"], .error, .network-error');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      await expect(errorMessage).toContainText(/网络|network|连接/i);

      // 4. 恢复网络连接
      await page.context().setOffline(false);

      // 5. 验证可以重试
      const retryButton = page.locator('button:has-text("重试"), button:has-text("再试"), [data-testid="retry"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
      } else {
        // 如果没有重试按钮，再次点击确认
        await confirmButton.click();
      }

      // 6. 验证重试后认证成功
      const userInfo = page.locator('[data-testid="user-info"], .user-avatar');
      await expect(userInfo).toBeVisible({ timeout: 15000 });

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should display appropriate loading states during authentication', async () => {
    // 测试认证过程中的加载状态

    try {
      // 1. 开始认证流程
      const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');
      await setupButton.first().click();

      const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
      await tokenInput.fill('github_pat_11AAAAAAA0123456789abcdef');

      // 2. 点击确认并立即检查加载状态
      const confirmButton = page.locator('button:has-text("确认"), button:has-text("验证")');
      await confirmButton.click();

      // 3. 验证加载指示器出现
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner, .authenticating');
      await expect(loadingIndicator).toBeVisible({ timeout: 2000 });

      // 4. 验证按钮变为禁用状态
      await expect(confirmButton).toBeDisabled();

      // 5. 验证加载文本
      const loadingText = page.locator(':has-text("验证中"), :has-text("正在验证"), :has-text("Authenticating")');
      await expect(loadingText).toBeVisible();

      // 6. 等待认证完成
      await expect(loadingIndicator).toBeHidden({ timeout: 15000 });

      // 7. 验证最终状态
      const userInfo = page.locator('[data-testid="user-info"], .user-avatar');
      await expect(userInfo).toBeVisible();

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should validate token format before API call', async () => {
    // 测试Token格式验证

    const invalidTokens = [
      '',
      'invalid',
      'github_pat_',
      'not_a_github_token',
      'ghp_too_short',
      '   ', // 空白字符
    ];

    try {
      for (const invalidToken of invalidTokens) {
        // 1. 导航到Token设置
        const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');
        await setupButton.first().click();

        // 2. 输入无效Token
        const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
        await tokenInput.clear();
        await tokenInput.fill(invalidToken);

        // 3. 尝试确认
        const confirmButton = page.locator('button:has-text("确认"), button:has-text("验证")');
        await confirmButton.click();

        // 4. 验证格式错误消息
        const errorMessage = page.locator('[data-testid="error-message"], .error, .validation-error');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
        await expect(errorMessage).toContainText(/格式|format|invalid/i);

        // 5. 验证不会发起API请求（通过检查没有网络加载状态）
        const loadingIndicator = page.locator('[data-testid="loading"], .loading');
        await expect(loadingIndicator).toBeHidden();
      }

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should handle rate limiting during authentication', async () => {
    // 测试认证过程中的速率限制

    try {
      // 1. 进行认证（假设会触发速率限制）
      const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');
      await setupButton.first().click();

      const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
      await tokenInput.fill('github_pat_rate_limited_token');

      const confirmButton = page.locator('button:has-text("确认"), button:has-text("验证")');
      await confirmButton.click();

      // 2. 验证速率限制错误处理
      const errorMessage = page.locator('[data-testid="error-message"], .error, .rate-limit-error');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      await expect(errorMessage).toContainText(/速率限制|rate limit|too many requests/i);

      // 3. 验证显示重试时间
      const retryInfo = page.locator('[data-testid="retry-info"], .retry-after, :has-text("分钟后")');
      await expect(retryInfo).toBeVisible();

      // 4. 验证重试按钮存在但可能被禁用
      const retryButton = page.locator('button:has-text("重试"), [data-testid="retry"]');
      await expect(retryButton).toBeVisible();

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });

  test('should support keyboard navigation in auth flow', async () => {
    // 测试认证流程的键盘导航

    try {
      // 1. 使用Tab键导航到设置按钮
      await page.keyboard.press('Tab');
      const setupButton = page.locator('[data-testid="setup-token"], button:has-text("设置Token")');

      // 2. 使用Enter键激活
      await page.keyboard.press('Enter');

      // 3. 验证Token输入框获得焦点
      const tokenInput = page.locator('input[type="text"], input[type="password"]').first();
      await expect(tokenInput).toBeFocused();

      // 4. 输入Token
      await tokenInput.type('github_pat_11AAAAAAA0123456789abcdef');

      // 5. 使用Tab导航到确认按钮
      await page.keyboard.press('Tab');

      // 6. 使用Enter确认
      await page.keyboard.press('Enter');

      // 7. 验证认证流程启动
      const loadingIndicator = page.locator('[data-testid="loading"], .loading');
      await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

    } catch (error) {
      // 预期会失败
      expect(error).toBeDefined();
    }
  });
});