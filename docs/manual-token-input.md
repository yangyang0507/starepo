# 手动 Token 输入功能设计方案

## 概述

本文档描述了 Starepo 应用中手动输入 GitHub Personal Access Token 的功能设计，为用户提供一个安全、便捷的 Token 管理方案。

## 功能需求

### 核心功能

1. **Token 输入界面** - 提供安全的 Token 输入表单
2. **Token 验证** - 实时验证 Token 的有效性和权限
3. **安全存储** - 加密存储用户输入的 Token
4. **权限检查** - 验证 Token 是否具备必要的权限
5. **Token 管理** - 支持更新、删除和重新验证 Token

### 用户体验要求

- 清晰的操作指引
- 实时的验证反馈
- 安全性提示和最佳实践建议
- 错误处理和恢复机制

## 界面设计

### 主界面布局

```
┌─────────────────────────────────────────────┐
│              Starepo                       │
│         GitHub Token 设置                   │
├─────────────────────────────────────────────┤
│                                             │
│  📝 输入您的 GitHub Personal Access Token   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Token: [ghp_xxxxxxxxxxxxxxxxxxxx]  │   │
│  │         [👁️ 显示/隐藏]              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ✅ 权限检查：                              │
│  • read:user ✓                             │
│  • user:email ✓                            │
│  • public_repo ✓                           │
│  • repo (可选) ⚠️                          │
│                                             │
│  💡 如何创建 Token？                        │
│  [查看详细指南]                             │
│                                             │
│  [验证并保存]  [取消]                       │
└─────────────────────────────────────────────┘
```

### Token 创建指南界面

```
┌─────────────────────────────────────────────┐
│          GitHub Token 创建指南               │
├─────────────────────────────────────────────┤
│                                             │
│  📋 创建步骤：                              │
│                                             │
│  1️⃣ 访问 GitHub Settings                   │
│     [打开 GitHub Token 设置页面]            │
│                                             │
│  2️⃣ 点击 "Generate new token (classic)"    │
│                                             │
│  3️⃣ 设置 Token 信息：                      │
│     • Note: Starepo App                   │
│     • Expiration: 建议选择 90 days         │
│                                             │
│  4️⃣ 选择权限范围：                         │
│     ✅ read:user                           │
│     ✅ user:email                          │
│     ✅ public_repo                         │
│     ⚪ repo (访问私有仓库，可选)             │
│                                             │
│  5️⃣ 点击 "Generate token"                  │
│                                             │
│  6️⃣ 复制生成的 Token                       │
│     ⚠️ Token 只显示一次，请立即复制         │
│                                             │
│  [返回输入页面]                             │
└─────────────────────────────────────────────┘
```

## 技术实现

### 1. Token 输入组件

```typescript
// src/renderer/components/auth/TokenInput.tsx
import React, { useState, useEffect } from 'react';
import { Input, Button, Alert, Progress, Card } from '@/components/ui';
import { Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TokenInputProps {
  onTokenValidated: (token: string, userInfo: GitHubUser) => void;
  onCancel: () => void;
}

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface TokenValidation {
  isValid: boolean;
  user?: GitHubUser;
  scopes: string[];
  missingScopes: string[];
  error?: string;
}

export const TokenInput: React.FC<TokenInputProps> = ({
  onTokenValidated,
  onCancel
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // 实时验证 Token
  useEffect(() => {
    if (token.length > 10) {
      const timeoutId = setTimeout(() => {
        validateToken(token);
      }, 500); // 防抖

      return () => clearTimeout(timeoutId);
    } else {
      setValidation(null);
    }
  }, [token]);

  const validateToken = async (tokenValue: string) => {
    setIsValidating(true);

    try {
      const result = await window.electronAPI.validateGitHubToken(tokenValue);
      setValidation(result);
    } catch (error) {
      setValidation({
        isValid: false,
        scopes: [],
        missingScopes: [],
        error: error instanceof Error ? error.message : '验证失败'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = () => {
    if (validation?.isValid && validation.user) {
      onTokenValidated(token, validation.user);
    }
  };

  const requiredScopes = ['read:user', 'user:email', 'public_repo'];
  const optionalScopes = ['repo'];

  return (
    <div className="token-input-container max-w-md mx-auto">
      {showGuide ? (
        <TokenGuide onBack={() => setShowGuide(false)} />
      ) : (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">输入 GitHub Token</h2>
              <p className="text-sm text-gray-600">
                请输入您的 GitHub Personal Access Token
              </p>
            </div>

            {/* Token 输入框 */}
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* 验证进度 */}
            {isValidating && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Progress value={50} className="flex-1" />
                  <span className="text-sm text-gray-500">验证中...</span>
                </div>
              </div>
            )}

            {/* 验证结果 */}
            {validation && (
              <div className="space-y-3">
                {validation.isValid ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        Token 验证成功！
                      </p>
                      {validation.user && (
                        <p className="text-sm text-green-700">
                          欢迎，{validation.user.name || validation.user.login}！
                        </p>
                      )}
                    </div>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Token 验证失败</p>
                      <p className="text-sm">{validation.error}</p>
                    </div>
                  </Alert>
                )}

                {/* 权限检查 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">权限检查：</h4>
                  <div className="space-y-1">
                    {requiredScopes.map(scope => {
                      const hasScope = validation.scopes.includes(scope);
                      return (
                        <div key={scope} className="flex items-center space-x-2 text-sm">
                          {hasScope ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={hasScope ? 'text-green-700' : 'text-red-700'}>
                            {scope} {hasScope ? '' : '(必需)'}
                          </span>
                        </div>
                      );
                    })}

                    {optionalScopes.map(scope => {
                      const hasScope = validation.scopes.includes(scope);
                      return (
                        <div key={scope} className="flex items-center space-x-2 text-sm">
                          {hasScope ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className={hasScope ? 'text-green-700' : 'text-yellow-700'}>
                            {scope} (可选)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 帮助链接 */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
                onClick={() => setShowGuide(true)}
              >
                💡 如何创建 GitHub Token？
              </button>
            </div>

            {/* 操作按钮 */}
            <div className="flex space-x-3">
              <Button
                onClick={handleSubmit}
                disabled={!validation?.isValid || validation.missingScopes.length > 0}
                className="flex-1"
              >
                验证并保存
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
```

### 2. Token 创建指南组件

```typescript
// src/renderer/components/auth/TokenGuide.tsx
import React from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { ExternalLink, ArrowLeft, Copy } from 'lucide-react';

interface TokenGuideProps {
  onBack: () => void;
}

export const TokenGuide: React.FC<TokenGuideProps> = ({ onBack }) => {
  const openGitHubTokenPage = () => {
    window.electronAPI.openExternal('https://github.com/settings/tokens/new');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const steps = [
    {
      number: 1,
      title: '访问 GitHub Settings',
      description: '点击下方按钮打开 GitHub Token 设置页面',
      action: (
        <Button onClick={openGitHubTokenPage} className="w-full">
          <ExternalLink className="mr-2 h-4 w-4" />
          打开 GitHub Token 设置页面
        </Button>
      )
    },
    {
      number: 2,
      title: '创建新 Token',
      description: '点击 "Generate new token (classic)" 按钮'
    },
    {
      number: 3,
      title: '设置 Token 信息',
      description: '填写以下信息：',
      details: [
        { label: 'Note', value: 'Starepo App', copyable: true },
        { label: 'Expiration', value: '建议选择 90 days 或更长' }
      ]
    },
    {
      number: 4,
      title: '选择权限范围',
      description: '请勾选以下权限：',
      details: [
        { label: 'read:user', required: true, description: '读取用户基本信息' },
        { label: 'user:email', required: true, description: '获取用户邮箱' },
        { label: 'public_repo', required: true, description: '访问公共仓库' },
        { label: 'repo', required: false, description: '访问私有仓库（可选）' }
      ]
    },
    {
      number: 5,
      title: '生成 Token',
      description: '点击页面底部的 "Generate token" 按钮'
    },
    {
      number: 6,
      title: '复制 Token',
      description: '⚠️ Token 只会显示一次，请立即复制并保存到安全的地方',
      warning: true
    }
  ];

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">GitHub Token 创建指南</h2>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex space-x-4">
              {/* 步骤编号 */}
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.warning ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {step.number}
                </div>
              </div>

              {/* 步骤内容 */}
              <div className="flex-1 space-y-2">
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>

                {/* 详细信息 */}
                {step.details && (
                  <div className="space-y-2">
                    {step.details.map((detail, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{detail.label}:</span>
                          <span className="text-sm">{detail.value}</span>
                          {'required' in detail && (
                            <Badge variant={detail.required ? 'destructive' : 'secondary'}>
                              {detail.required ? '必需' : '可选'}
                            </Badge>
                          )}
                        </div>
                        {'copyable' in detail && detail.copyable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(detail.value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 权限详情 */}
                {step.number === 4 && step.details && (
                  <div className="space-y-1">
                    {step.details.map((scope, index) => (
                      <div key={index} className="text-xs text-gray-500 ml-4">
                        • {scope.description}
                      </div>
                    ))}
                  </div>
                )}

                {/* 操作按钮 */}
                {step.action && (
                  <div className="pt-2">
                    {step.action}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 安全提示 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">🔒 安全提示</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Token 具有与您的 GitHub 账户相同的权限，请妥善保管</li>
            <li>• 不要在公共场所或不安全的网络环境下输入 Token</li>
            <li>• 如果怀疑 Token 泄露，请立即在 GitHub 设置中撤销</li>
            <li>• Starepo 会将 Token 加密存储在本地，不会上传到任何服务器</li>
          </ul>
        </div>

        {/* 返回按钮 */}
        <div className="text-center">
          <Button onClick={onBack} className="w-full">
            返回 Token 输入页面
          </Button>
        </div>
      </div>
    </Card>
  );
};
```

### 3. Token 验证服务

```typescript
// src/main/services/token-validator.ts
import { Octokit } from "@octokit/rest";

export interface TokenValidationResult {
  isValid: boolean;
  user?: {
    login: string;
    name: string;
    email: string;
    avatar_url: string;
  };
  scopes: string[];
  missingScopes: string[];
  error?: string;
}

export class GitHubTokenValidator {
  private static readonly REQUIRED_SCOPES = [
    "read:user",
    "user:email",
    "public_repo",
  ];
  private static readonly OPTIONAL_SCOPES = ["repo"];

  static async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // 创建 Octokit 实例
      const octokit = new Octokit({
        auth: token,
        userAgent: "Starepo/1.0.0",
      });

      // 验证 Token 并获取用户信息
      const [userResponse, emailResponse] = await Promise.all([
        octokit.rest.users.getAuthenticated(),
        octokit.rest.users
          .listEmailsForAuthenticatedUser()
          .catch(() => ({ data: [] })),
      ]);

      const user = userResponse.data;
      const emails = emailResponse.data;
      const primaryEmail =
        emails.find((email) => email.primary)?.email || user.email;

      // 获取 Token 权限范围
      const scopes = this.extractScopesFromHeaders(userResponse.headers);

      // 检查必需权限
      const missingScopes = this.REQUIRED_SCOPES.filter(
        (scope) => !scopes.includes(scope),
      );

      return {
        isValid: missingScopes.length === 0,
        user: {
          login: user.login,
          name: user.name || user.login,
          email: primaryEmail || "",
          avatar_url: user.avatar_url,
        },
        scopes,
        missingScopes,
      };
    } catch (error) {
      console.error("Token 验证失败:", error);

      let errorMessage = "Token 验证失败";

      if (error instanceof Error) {
        if (error.message.includes("401")) {
          errorMessage = "Token 无效或已过期";
        } else if (error.message.includes("403")) {
          errorMessage = "Token 权限不足";
        } else if (error.message.includes("404")) {
          errorMessage = "GitHub API 访问失败";
        } else {
          errorMessage = error.message;
        }
      }

      return {
        isValid: false,
        scopes: [],
        missingScopes: this.REQUIRED_SCOPES,
        error: errorMessage,
      };
    }
  }

  private static extractScopesFromHeaders(headers: any): string[] {
    const scopeHeader = headers["x-oauth-scopes"];
    if (!scopeHeader) return [];

    return scopeHeader
      .split(",")
      .map((scope: string) => scope.trim())
      .filter((scope: string) => scope.length > 0);
  }

  // 检查 Token 是否具备特定权限
  static async checkTokenPermissions(
    token: string,
    requiredScopes: string[],
  ): Promise<boolean> {
    const result = await this.validateToken(token);
    return (
      result.isValid &&
      requiredScopes.every((scope) => result.scopes.includes(scope))
    );
  }

  // 获取 Token 的详细信息
  static async getTokenInfo(token: string): Promise<any> {
    try {
      const octokit = new Octokit({ auth: token });

      // 获取 Token 的应用信息
      const response = await octokit.request("GET /applications/grants", {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return response.data;
    } catch (error) {
      console.error("获取 Token 信息失败:", error);
      return null;
    }
  }
}
```

### 4. 安全存储实现

```typescript
// src/main/services/secure-token-storage.ts
import { safeStorage, app } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import * as crypto from "crypto";

export class SecureTokenStorage {
  private static readonly TOKEN_FILE = "github-token.enc";
  private static readonly BACKUP_ENCRYPTION_KEY = "starepo-github-token-key";

  // 获取存储路径
  private static getStoragePath(): string {
    return path.join(app.getPath("userData"), this.TOKEN_FILE);
  }

  // 存储 Token
  static async storeToken(token: string, userInfo: any): Promise<void> {
    try {
      const tokenData = {
        token,
        userInfo,
        createdAt: Date.now(),
        lastValidated: Date.now(),
      };

      const jsonData = JSON.stringify(tokenData);
      let encryptedData: Buffer;

      // 优先使用系统安全存储
      if (safeStorage.isEncryptionAvailable()) {
        encryptedData = safeStorage.encryptString(jsonData);
      } else {
        // 降级到自定义加密
        encryptedData = this.fallbackEncrypt(jsonData);
      }

      // 写入文件
      await fs.writeFile(this.getStoragePath(), encryptedData);

      console.log("Token 已安全存储");
    } catch (error) {
      console.error("Token 存储失败:", error);
      throw new Error("Token 存储失败");
    }
  }

  // 读取 Token
  static async retrieveToken(): Promise<{
    token: string;
    userInfo: any;
  } | null> {
    try {
      const storagePath = this.getStoragePath();

      // 检查文件是否存在
      try {
        await fs.access(storagePath);
      } catch {
        return null; // 文件不存在
      }

      // 读取加密数据
      const encryptedData = await fs.readFile(storagePath);
      let jsonData: string;

      // 解密数据
      if (safeStorage.isEncryptionAvailable()) {
        jsonData = safeStorage.decryptString(encryptedData);
      } else {
        jsonData = this.fallbackDecrypt(encryptedData);
      }

      // 解析数据
      const tokenData = JSON.parse(jsonData);

      return {
        token: tokenData.token,
        userInfo: tokenData.userInfo,
      };
    } catch (error) {
      console.error("Token 读取失败:", error);
      return null;
    }
  }

  // 删除 Token
  static async clearToken(): Promise<void> {
    try {
      const storagePath = this.getStoragePath();
      await fs.unlink(storagePath);
      console.log("Token 已删除");
    } catch (error) {
      // 文件不存在时忽略错误
      if (error.code !== "ENOENT") {
        console.error("Token 删除失败:", error);
      }
    }
  }

  // 更新最后验证时间
  static async updateLastValidated(): Promise<void> {
    const tokenData = await this.retrieveToken();
    if (tokenData) {
      await this.storeToken(tokenData.token, {
        ...tokenData.userInfo,
        lastValidated: Date.now(),
      });
    }
  }

  // 降级加密（当系统安全存储不可用时）
  private static fallbackEncrypt(data: string): Buffer {
    const key = crypto.scryptSync(this.BACKUP_ENCRYPTION_KEY, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher("aes-256-cbc", key);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    // 将 IV 和加密数据组合
    return Buffer.concat([iv, Buffer.from(encrypted, "hex")]);
  }

  // 降级解密
  private static fallbackDecrypt(encryptedData: Buffer): string {
    const key = crypto.scryptSync(this.BACKUP_ENCRYPTION_KEY, "salt", 32);
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16).toString("hex");

    const decipher = crypto.createDecipher("aes-256-cbc", key);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  // 检查 Token 是否存在
  static async hasToken(): Promise<boolean> {
    try {
      await fs.access(this.getStoragePath());
      return true;
    } catch {
      return false;
    }
  }
}
```

### 5. IPC 通信接口

```typescript
// src/main/ipc/token.ts
import { ipcMain } from "electron";
import { GitHubTokenValidator } from "../services/token-validator";
import { SecureTokenStorage } from "../services/secure-token-storage";

export const setupTokenIPC = () => {
  // 验证 Token
  ipcMain.handle("validate-github-token", async (_, token: string) => {
    return await GitHubTokenValidator.validateToken(token);
  });

  // 存储 Token
  ipcMain.handle(
    "store-github-token",
    async (_, token: string, userInfo: any) => {
      await SecureTokenStorage.storeToken(token, userInfo);
      return true;
    },
  );

  // 读取 Token
  ipcMain.handle("retrieve-github-token", async () => {
    return await SecureTokenStorage.retrieveToken();
  });

  // 删除 Token
  ipcMain.handle("clear-github-token", async () => {
    await SecureTokenStorage.clearToken();
    return true;
  });

  // 检查 Token 是否存在
  ipcMain.handle("has-github-token", async () => {
    return await SecureTokenStorage.hasToken();
  });
};
```

### 6. Preload 脚本扩展

```typescript
// src/preload/preload.ts (扩展)
contextBridge.exposeInMainWorld("electronAPI", {
  // ... 其他 API

  // Token 相关 API
  validateGitHubToken: (token: string) =>
    ipcRenderer.invoke("validate-github-token", token),

  storeGitHubToken: (token: string, userInfo: any) =>
    ipcRenderer.invoke("store-github-token", token, userInfo),

  retrieveGitHubToken: () => ipcRenderer.invoke("retrieve-github-token"),

  clearGitHubToken: () => ipcRenderer.invoke("clear-github-token"),

  hasGitHubToken: () => ipcRenderer.invoke("has-github-token"),
});
```

## 安全考虑

### 1. Token 安全存储

- 优先使用 Electron 的 `safeStorage` API
- 降级到自定义 AES 加密
- 存储在用户数据目录，避免版本控制

### 2. 输入验证

- 实时验证 Token 格式
- 检查必需权限范围
- 防止无效 Token 存储

### 3. 错误处理

- 不在错误信息中暴露敏感信息
- 提供清晰的用户指导
- 记录详细的调试信息

### 4. 用户隐私

- 本地存储，不上传到服务器
- 提供清除功能
- 明确告知数据用途

## 用户体验优化

### 1. 实时反馈

- 输入时实时验证
- 权限检查可视化
- 加载状态指示

### 2. 错误恢复

- 详细的错误说明
- 提供解决方案
- 一键重试功能

### 3. 帮助指导

- 内置创建指南
- 外部链接到 GitHub
- 权限说明和用途

## 测试策略

### 1. 单元测试

- Token 验证逻辑
- 加密解密功能
- 权限检查算法

### 2. 集成测试

- 完整输入流程
- 存储和读取
- 错误场景处理

### 3. 安全测试

- 加密强度验证
- 权限边界测试
- 数据泄露检查

## 下一步

1. 集成 Octokit.js 客户端架构
2. 实现统一的认证管理
3. 添加 Token 生命周期管理
4. 完善错误处理和用户体验
