# Starepo 自动化测试方案

## 📋 概述

本文档描述了 Starepo Electron 应用的完整自动化测试方案，包括单元测试、集成测试和 E2E 测试。

## 🎯 测试金字塔

```
        E2E Tests (10%)
       /              \
      /   Integration   \
     /    Tests (20%)    \
    /____________________\
   /                      \
  /   Unit Tests (70%)     \
 /__________________________\
```

## 🛠️ 测试工具栈

### 已配置

- **Vitest** - 单元测试和集成测试框架
- **Playwright** - E2E 测试框架
- **Testing Library** - React 组件测试
- **electron-playwright-helpers** - Electron 特定测试工具

### 推荐添加

```bash
npm install -D @vitest/ui @vitest/coverage-v8 happy-dom
```

## 📁 测试文件结构

```
src/tests/
├── unit/                           # 单元测试 (70%)
│   ├── main/                       # Main Process 测试
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── provider-account-service.test.ts
│   │   │   │   ├── model-discovery-service.test.ts
│   │   │   │   └── ai-service.test.ts
│   │   │   ├── github/
│   │   │   │   └── github-service.test.ts
│   │   │   └── database/
│   │   │       └── lancedb-service.test.ts
│   │   └── ipc/
│   │       └── ai-handlers.test.ts
│   ├── renderer/                   # Renderer Process 测试
│   │   ├── stores/
│   │   │   ├── auth-store.test.ts
│   │   │   └── ai-accounts-store.test.ts
│   │   ├── hooks/
│   │   │   └── useAIApi.test.ts
│   │   └── components/
│   │       ├── ai/
│   │       │   ├── provider-setting.test.tsx
│   │       │   └── model-list.test.tsx
│   │       └── chat/
│   │           └── chat-interface.test.tsx
│   └── shared/
│       └── utils/
│           └── helpers.test.ts
├── integration/                    # 集成测试 (20%)
│   ├── ai-provider-flow.test.ts
│   ├── github-sync-flow.test.ts
│   └── ipc-communication.test.ts
├── e2e/                           # E2E 测试 (10%)
│   ├── ai-settings.spec.ts
│   ├── github-auth.spec.ts
│   └── search-flow.spec.ts
├── helpers/                       # 测试辅助工具
│   ├── mock-ipc.ts
│   ├── mock-electron.ts
│   └── test-utils.tsx
└── factories/                     # 测试数据工厂
    ├── ai-provider.factory.ts
    ├── github.factory.ts
    └── user.factory.ts
```

## 📝 测试示例

### 1. 单元测试示例

#### Service 测试

```typescript
// src/tests/unit/main/services/provider-account-service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProviderAccountService } from "@main/services/ai/storage/provider-account-service";
import { createMockProviderAccount } from "../../../factories/ai-provider.factory";

describe("ProviderAccountService", () => {
  let service: ProviderAccountService;

  beforeEach(() => {
    service = ProviderAccountService.getInstance();
  });

  it("should save account with encrypted API key", async () => {
    const mockAccount = createMockProviderAccount();
    await service.saveAccount(mockAccount);

    const saved = await service.getAccount(mockAccount.providerId);
    expect(saved?.apiKey).toBeDefined();
  });
});
```

#### React 组件测试

```typescript
// src/tests/unit/renderer/components/provider-setting.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProviderSetting } from '@/components/ai/provider-setting';
import { AI_PROVIDER_ID } from '@shared/types/ai-provider';

describe('ProviderSetting', () => {
  it('should render provider settings form', () => {
    render(<ProviderSetting providerId={AI_PROVIDER_ID.OPENAI} />);

    expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Base URL/i)).toBeInTheDocument();
  });

  it('should show success message after saving', async () => {
    render(<ProviderSetting providerId={AI_PROVIDER_ID.OPENAI} />);

    const apiKeyInput = screen.getByLabelText(/API Key/i);
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });

    await waitFor(() => {
      expect(screen.getByText(/已自动保存/i)).toBeInTheDocument();
    });
  });
});
```

### 2. 集成测试示例

```typescript
// src/tests/integration/ai-provider-flow.test.ts
import { describe, it, expect } from "vitest";
import { providerAccountService } from "@main/services/ai/storage/provider-account-service";
import { modelDiscoveryService } from "@main/services/ai/discovery/model-discovery-service";
import { createMockProviderAccount } from "../factories/ai-provider.factory";

describe("AI Provider Configuration Flow", () => {
  it("should complete full provider setup flow", async () => {
    const mockConfig = createMockProviderAccount();

    // 1. 保存 Provider 账户
    await providerAccountService.saveAccount(mockConfig);

    // 2. 测试连接
    const testResult = await modelDiscoveryService.testConnection(mockConfig);
    expect(testResult.success).toBe(true);

    // 3. 加载模型列表
    const models = await modelDiscoveryService.getModels(mockConfig);
    expect(models.models.length).toBeGreaterThan(0);

    // 4. 验证账户已保存
    const saved = await providerAccountService.getAccount(
      mockConfig.providerId,
    );
    expect(saved).toBeDefined();
  });
});
```

### 3. E2E 测试示例

```typescript
// src/tests/e2e/ai-settings.spec.ts
import { test, expect, _electron as electron } from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

test.describe("AI Settings E2E", () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    const latestBuild = findLatestBuild();
    const appInfo = parseElectronApp(latestBuild);

    electronApp = await electron.launch({
      args: [appInfo.main],
      executablePath: appInfo.executable,
    });

    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("should configure AI provider end-to-end", async () => {
    // 1. 导航到 AI 设置
    await window.click('[data-testid="settings-button"]');
    await window.click('[data-testid="ai-settings-tab"]');

    // 2. 选择 Provider
    await window.click('[data-testid="provider-openai"]');

    // 3. 输入 API Key
    await window.fill('[data-testid="api-key-input"]', "test-key");

    // 4. 等待自动保存
    await expect(window.locator('[data-testid="save-status"]')).toContainText(
      "已自动保存",
    );

    // 5. 测试连接
    await window.click('[data-testid="test-connection"]');

    // 6. 验证成功
    await expect(window.locator('[data-testid="test-status"]')).toContainText(
      "成功",
    );
  });
});
```

## 🎨 测试最佳实践

### 1. 测试命名规范

使用 Given-When-Then 模式：

```typescript
describe("ProviderAccountService", () => {
  describe("saveAccount", () => {
    it("should save account when valid config provided", async () => {
      // Given
      const mockAccount = createMockProviderAccount();

      // When
      await service.saveAccount(mockAccount);

      // Then
      const saved = await service.getAccount(mockAccount.providerId);
      expect(saved).toBeDefined();
    });
  });
});
```

### 2. Mock 策略

#### Mock IPC 通信

```typescript
import { createMockIPC } from "../helpers/mock-ipc";

const mockIPC = createMockIPC();
vi.mock("electron", () => ({
  ipcMain: mockIPC,
  ipcRenderer: mockIPC,
}));
```

#### Mock 文件系统

```typescript
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
```

### 3. 测试数据工厂

使用工厂函数创建测试数据：

```typescript
// tests/factories/ai-provider.factory.ts
export function createMockProviderAccount(
  overrides?: Partial<ProviderAccountConfig>,
): ProviderAccountConfig {
  return {
    providerId: AI_PROVIDER_ID.OPENAI,
    apiKey: "test-api-key",
    protocol: AI_PROTOCOL.OPENAI_COMPATIBLE,
    timeout: 30000,
    retries: 3,
    strictTLS: true,
    enabled: true,
    ...overrides,
  };
}
```

### 4. 异步测试

```typescript
it("should handle async operations", async () => {
  // 使用 waitFor 等待异步操作
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  // 使用 act 包装状态更新
  await act(async () => {
    await result.current.loadModels();
  });
});
```

## 📊 测试覆盖率目标

```
Overall Coverage: 80%+
├── Statements: 80%
├── Branches: 75%
├── Functions: 80%
└── Lines: 80%

Critical Paths: 90%+
├── Authentication Flow
├── AI Provider Configuration
├── IPC Communication
└── Data Persistence
```

## 🚀 运行测试

### 单元测试

```bash
# 运行所有单元测试
npm run test:unit

# 监听模式
npm run test:watch

# 带覆盖率
npm run test:unit -- --coverage
```

### E2E 测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行特定测试
npm run test:e2e -- ai-settings.spec.ts

# UI 模式
npm run test:e2e -- --ui
```

### 所有测试

```bash
npm run test:all
```

## 🔧 配置文件

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    include: ["src/tests/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["src/tests/e2e/**/*"],
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/unit/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
```

## 📈 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20.x"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 🎯 下一步行动

### 立即可做

1. 为 AI 设置相关的核心功能编写单元测试
2. 添加 IPC 通信的集成测试
3. 设置 CI/CD 自动运行测试

### 短期目标（1-2周）

1. 达到 60% 代码覆盖率
2. 完成关键流程的 E2E 测试
3. 建立测试数据工厂

### 长期目标（1个月）

1. 达到 80% 代码覆盖率
2. 完整的测试文档
3. 性能测试和压力测试

## 📚 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Playwright 文档](https://playwright.dev/)
- [Testing Library 文档](https://testing-library.com/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
