# Starepo - GitHub Star 智能管理工具

> 仍在建设中……

一个基于 Electron 的本地桌面应用，帮助你智能管理和检索 GitHub Star 项目。通过 **Agentic AI 工具系统**和自然语言对话，让 AI 自主帮你找到需要的项目。

## 🌟 核心功能

- **GitHub 集成**: 自动同步你的 GitHub Star 项目信息
- **Agentic AI 系统**: AI Agent 自主调用工具，智能查找项目
- **多维度搜索**: 关键词、标签、语言、Star 数、更新时间等多种搜索工具
- **自然语言对话**: 用自然语言描述需求，AI 自动理解并执行
- **本地数据存储**: 所有数据本地化存储，保护隐私
- **实时同步**: 支持增量同步最新的 Star 项目

## 🛠️ 技术栈

### 核心框架 🏍️

- [Electron 37.2.5](https://www.electronjs.org) - 跨平台桌面应用框架
- [Vite 7.0.6](https://vitejs.dev) - 现代化构建工具
- [React 19.1.1](https://reactjs.org) - 用户界面库
- [TypeScript 5.8.3](https://www.typescriptlang.org) - 类型安全的 JavaScript

### AI & 数据处理 🤖

- [AI SDK V5](https://ai-sdk.dev/) - 统一的 AI 接口，支持多种 AI 提供商
- [GitHub API](https://docs.github.com/en/rest) - GitHub 数据获取
- **Agentic AI 工具系统** - AI Agent 自主调用工具链完成复杂任务

### UI & 用户体验 🎨

- [Tailwind 4.1.11](https://tailwindcss.com) - 原子化 CSS 框架
- [Shadcn UI](https://ui.shadcn.com) - 现代化组件库
- [Geist](https://vercel.com/font) - 优雅字体
- [Lucide](https://lucide.dev) - 图标库
- [TanStack Router](https://tanstack.com/router) - 路由管理
- [i18next](https://www.i18next.com) - 国际化支持

### 开发工具 🛠️

- [Prettier 3.6.2](https://prettier.io) - 代码格式化
- [ESLint 9.32.0](https://eslint.org) - 代码检查
- [Zod 4.0.14](https://zod.dev) - 数据验证
- [React Query (TanStack)](https://react-query.tanstack.com) - 数据状态管理

### 测试框架 🧪

- [Vitest 3.2.4](https://vitest.dev) - 单元测试框架
- [Playwright 1.54.2](https://playwright.dev) - 端到端测试
- [React Testing Library 16.3.0](https://testing-library.com/docs/react-testing-library/intro) - React 组件测试

### 打包分发 📦

- [Electron Forge](https://www.electronforge.io) - 应用打包和分发

## 🏗️ 功能规划

### Phase 0: 架构重构 ✅ (已完成)
- [x] **Electron 进程分离架构**：主进程、渲染进程、预加载脚本分离
- [x] **类型安全的 IPC 通信**：统一 IPC 通道管理和类型定义
- [x] **现代化项目结构**：按功能和进程分层的目录结构
- [x] **安全的 API 桥接**：预加载脚本安全暴露主进程功能
- [x] **React Hooks 集成**：useTheme、useWindow 等自定义 Hooks
- [x] **开发工具链优化**：Vite、TypeScript、ESLint 配置更新

### Phase 1: 基础功能 (MVP) 🏗️
- [ ] **GitHub 集成系统** (基于 [Octokit.js](https://github.com/octokit/octokit.js))
  - [ ] Personal Access Token 认证方式
  - [ ] 安全的 Token 存储和管理（使用 Electron safeStorage）
  - [ ] 完整的 GitHub API 集成（用户信息、仓库管理、Star 操作）
  - [ ] 速率限制监控和智能重试机制
  - [ ] 数据本地缓存（JSON/SQLite）
- [ ] **Star 项目数据管理**
  - [ ] 增量同步 Star 项目列表
  - [ ] 项目详细信息获取（语言统计、README、发布版本）
  - [ ] 实时 Star/Unstar 操作同步
  - [ ] 本地数据持久化存储
- [ ] **基础搜索和筛选工具**
  - [ ] 按名称、描述关键词搜索
  - [ ] 按语言、Star 数、更新时间筛选
  - [ ] 按标签和主题过滤
  - [ ] 全文搜索（README 内容）

### Phase 2: Agentic AI 工具系统 🤖
- [ ] **AI Agent 核心架构**
  - [ ] AI SDK V5 集成（支持多 Provider）
  - [ ] Tool Calling 系统实现
  - [ ] 对话上下文管理
  - [ ] 流式响应处理
- [ ] **搜索工具集**
  - [ ] `searchByKeyword`: 关键词搜索工具
  - [ ] `filterByLanguage`: 语言筛选工具
  - [ ] `filterByStars`: Star 数范围筛选
  - [ ] `filterByDate`: 更新时间筛选
  - [ ] `searchByTopic`: 主题标签搜索
  - [ ] `searchInReadme`: README 全文搜索
- [ ] **分析工具集**
  - [ ] `analyzeLanguageDistribution`: 语言分布统计
  - [ ] `findTrendingRepos`: 热门项目发现
  - [ ] `compareRepos`: 项目对比分析

### Phase 3: AI 对话系统优化 💬
- [ ] 聊天界面设计和实现
- [ ] 多轮对话上下文保持
- [ ] 搜索结果智能展示
- [ ] 工具调用可视化（显示 AI 使用了哪些工具）
- [ ] 搜索历史和收藏功能

### Phase 4: 高级功能 ✨
- [ ] 项目标签和分类管理
- [ ] 个人笔记和评价系统
- [ ] 数据导出和备份功能
- [ ] 多账户支持
- [ ] 自定义工具扩展系统

## 🏛️ 系统架构

### 整体架构（Agentic AI 驱动）
```mermaid
graph TB
    User[用户] -->|自然语言查询| ChatUI[聊天界面]
    ChatUI -->|消息| AIAgent[AI Agent]
    
    AIAgent -->|调用工具| ToolRegistry[工具注册表]
    
    ToolRegistry -->|搜索工具| SearchTools[搜索工具集<br/>• 关键词搜索<br/>• 语言筛选<br/>• Star 筛选<br/>• 主题搜索]
    ToolRegistry -->|分析工具| AnalysisTools[分析工具集<br/>• 语言分布<br/>• 热门发现<br/>• 项目对比]
    ToolRegistry -->|GitHub 工具| GitHubTools[GitHub 工具集<br/>• 获取详情<br/>• Star/Unstar<br/>• 同步数据]
    
    SearchTools --> LocalDB[(本地数据库<br/>JSON/SQLite)]
    AnalysisTools --> LocalDB
    GitHubTools --> GitHubAPI[GitHub API]
    GitHubAPI --> LocalDB
    
    LocalDB --> SearchTools
    
    AIAgent -->|结果| ChatUI
    ChatUI -->|展示| User
```

### 数据流程（基于 AI Agent + Tools）
1. **用户输入**: 自然语言查询 → AI Agent
2. **意图理解**: AI Agent 理解用户需求
3. **工具选择**: AI Agent 决定使用哪些工具
4. **工具执行**: 
   - 调用搜索工具（关键词、语言、Star 数等）
   - 调用分析工具（统计、对比、发现趋势）
   - 调用 GitHub 工具（获取最新数据）
5. **结果整合**: AI Agent 整合多个工具的结果
6. **智能回复**: 生成自然语言回复，展示结果

### 项目配置 🎯

- **安全隔离**: 启用 Context Isolation，主进程和渲染进程完全分离
- **编译优化**: React Compiler 默认启用
- **界面设计**: 隐藏标题栏，使用自定义标题栏
- **字体选择**: Geist 作为默认字体
- **开发工具**: React DevTools 预装
- **数据安全**: 所有数据本地存储，保护用户隐私
- **类型安全**: 完整的 TypeScript 支持，IPC 通信类型安全
- **模块化架构**: 按功能分离的服务层，易于维护和扩展

### 架构优势 🏆

1. **安全性**: 
   - Context Isolation 确保渲染进程无法直接访问 Node.js API
   - 预加载脚本提供受控的 API 暴露
   - 敏感操作只在主进程中执行

2. **可维护性**:
   - 清晰的进程分离，职责明确
   - 统一的 IPC 通道管理
   - 类型安全的接口定义

3. **可扩展性**:
   - 模块化的服务层设计
   - 易于添加新功能模块
   - 支持插件化架构

4. **开发体验**:
   - 完整的 TypeScript 支持
   - React Hooks 简化状态管理  
   - 热重载和开发工具集成

## 📁 项目结构

```plaintext
.
└── ./src/
    ├── ./src/main/              # 主进程代码
    │   ├── ./src/main/main.ts          # 主进程入口
    │   ├── ./src/main/menu.ts          # 应用菜单
    │   ├── ./src/main/window.ts        # 窗口管理
    │   ├── ./src/main/services/        # 主进程服务
    │   │   ├── ./src/main/services/github/     # GitHub API 服务
    │   │   ├── ./src/main/services/database/   # 数据库服务
    │   │   ├── ./src/main/services/ai/         # AI 服务
    │   │   └── ./src/main/services/file/       # 文件系统服务
    │   ├── ./src/main/ipc/             # 主进程 IPC 处理器
    │   │   ├── ./src/main/ipc/handlers/        # IPC 处理函数
    │   │   └── ./src/main/ipc/channels.ts      # IPC 通道定义
    │   └── ./src/main/utils/           # 主进程工具函数
    ├── ./src/preload/           # 预加载脚本
    │   ├── ./src/preload/preload.ts    # 预加载脚本入口
    │   ├── ./src/preload/api.ts        # API 暴露接口
    │   └── ./src/preload/types.ts      # 预加载类型定义
    ├── ./src/renderer/          # 渲染进程代码
    │   ├── ./src/renderer/main.tsx     # 渲染进程入口
    │   ├── ./src/renderer/app.tsx      # 应用根组件
    │   ├── ./src/renderer/components/  # UI 组件
    │   │   ├── ./src/renderer/components/ui/        # 基础 UI 组件
    │   │   ├── ./src/renderer/components/chat/      # 聊天相关组件
    │   │   ├── ./src/renderer/components/repo/      # 项目展示组件
    │   │   ├── ./src/renderer/components/search/    # 搜索相关组件
    │   │   └── ./src/renderer/components/layout/    # 布局组件
    │   ├── ./src/renderer/pages/       # 页面组件
    │   │   ├── ./src/renderer/pages/dashboard/     # 主面板
    │   │   ├── ./src/renderer/pages/chat/          # 聊天页面
    │   │   ├── ./src/renderer/pages/settings/      # 设置页面
    │   │   └── ./src/renderer/pages/auth/          # 认证页面
    │   ├── ./src/renderer/stores/      # 客户端状态管理
    │   │   ├── ./src/renderer/stores/auth/         # 认证状态
    │   │   ├── ./src/renderer/stores/repos/        # 项目数据状态
    │   │   └── ./src/renderer/stores/chat/         # 聊天状态
    │   ├── ./src/renderer/hooks/       # React Hooks
    │   ├── ./src/renderer/utils/       # 渲染进程工具函数
    │   ├── ./src/renderer/services/    # 渲染进程服务层
    │   │   └── ./src/renderer/services/api.ts      # API 调用封装
    │   ├── ./src/renderer/routes/      # 路由配置
    │   └── ./src/renderer/styles/      # 样式文件
    ├── ./src/shared/            # 共享代码
    │   ├── ./src/shared/types/         # 共享类型定义
    │   ├── ./src/shared/constants/     # 常量定义
    │   ├── ./src/shared/utils/         # 共享工具函数
    │   └── ./src/shared/schemas/       # 数据验证模式
    ├── ./src/assets/            # 静态资源
    │   ├── ./src/assets/fonts/
    │   ├── ./src/assets/icons/
    │   └── ./src/assets/images/
    └── ./src/tests/             # 测试文件
        ├── ./src/tests/main/           # 主进程测试
        ├── ./src/tests/renderer/       # 渲染进程测试
        └── ./src/tests/e2e/            # 端到端测试
```

### 目录说明

#### 🔧 主进程 (`main/`)
- **`services/`**: 核心业务逻辑层
  - `github/`: GitHub API 集成，处理 Token 认证和数据获取
  - `database/`: 本地数据存储（JSON/SQLite）
  - `ai/`: AI Agent 核心系统和工具注册表
  - `tools/`: AI 可调用的工具集合
- **`ipc/`**: IPC 通信处理器
  - `handlers/`: 各种 IPC 请求的处理函数
  - `channels.ts`: IPC 通道名称和类型定义

#### 🎨 渲染进程 (`renderer/`)
- **`components/`**: 可复用 UI 组件
  - `chat/`: 聊天界面、消息气泡、输入框等
  - `repo/`: 项目卡片、列表、详情等
  - `search/`: 搜索框、筛选器、结果展示等
  - `layout/`: 布局相关组件
- **`stores/`**: 客户端状态管理
  - `auth/`: 用户认证状态和 GitHub Token 管理
  - `repos/`: Star 项目数据和缓存
  - `chat/`: 聊天历史和上下文
- **`pages/`**: 主要页面组件
  - `dashboard/`: 项目概览和管理
  - `chat/`: AI 对话检索界面
  - `settings/`: 应用设置和配置
- **`hooks/`**: 自定义 React Hooks
- **`services/`**: 渲染进程服务层（API 调用封装）

#### 🔗 预加载脚本 (`preload/`)
- **安全的 API 桥接**: 在渲染进程和主进程间提供安全的通信接口
- **类型安全**: 完整的 TypeScript 类型定义

#### 🤝 共享代码 (`shared/`)
- **`types/`**: 主进程和渲染进程共享的类型定义
  - 完整的 TypeScript 接口：`ThemeMode`、`Language`、`GitHubRepo` 等
  - API 响应类型和错误处理类型
- **`constants/`**: 应用常量和配置
  - `ipc-channels.ts`: 统一的 IPC 通道定义，确保类型安全
- **`utils/`**: 通用工具函数
- **`schemas/`**: Zod 数据验证模式

### 已实现的核心功能 ✅

#### 🔧 IPC 通信系统
- **窗口控制**: 最小化、最大化、关闭、全屏切换
- **主题管理**: 明暗主题切换、系统主题跟随
- **语言切换**: 多语言支持（英文/中文）
- **类型安全**: 完整的 TypeScript 类型定义和验证

#### 🎨 React 集成
- **自定义 Hooks**:
  - `useTheme()`: 主题状态管理和切换
  - `useWindow()`: 窗口控制操作
  - `useLanguage()`: 语言管理（待实现）
- **API 服务层**: 封装所有 IPC 调用，提供错误处理
- **状态管理**: React 状态与主进程状态同步

#### 🛡️ 安全架构
- **Context Isolation**: 完全隔离的运行环境
- **预加载脚本**: 安全的 API 桥接，只暴露必要的功能
- **类型验证**: 运行时类型检查和错误处理

#### 🔧 IPC 通信系统
- **窗口控制**: 最小化、最大化、关闭、全屏切换
- **主题管理**: 明暗主题切换、系统主题跟随
- **语言切换**: 多语言支持（英文/中文）
- **类型安全**: 完整的 TypeScript 类型定义和验证

#### 🎨 React 集成
- **自定义 Hooks**: 
  - `useTheme()`: 主题状态管理和切换
  - `useWindow()`: 窗口控制操作
  - `useLanguage()`: 语言管理（待实现）
- **API 服务层**: 封装所有 IPC 调用，提供错误处理
- **状态管理**: React 状态与主进程状态同步

#### 🛡️ 安全架构
- **Context Isolation**: 完全隔离的运行环境
- **预加载脚本**: 安全的 API 桥接，只暴露必要的功能
- **类型验证**: 运行时类型检查和错误处理

## 🚀 开发脚本

运行脚本命令：

```bash
npm run <script>
```

### 开发和构建
- `start`: 启动开发模式（支持热重载）
- `package`: 打包应用程序
- `make`: 生成平台特定的安装包
- `publish`: 发布应用程序

### 代码质量
- `lint`: 运行 ESLint 代码检查
- `lint:fix`: 自动修复 ESLint 问题
- `format`: 检查代码格式（不修改代码）
- `format:write`: 格式化代码

### 测试
- `test`: 运行所有测试
- `test:unit`: 运行单元测试 (Vitest)
- `test:e2e`: 运行端到端测试 (Playwright)
- `test:watch`: 监听模式运行测试

### 未来功能脚本
- `db:init`: 初始化本地数据存储
- `db:reset`: 重置数据库
- `sync:github`: 手动同步 GitHub Stars

> **注意**: 端到端测试需要先构建应用程序，运行测试前请先执行 `npm run package`

## 🧑‍💻 开发指南

### 如何添加新功能

#### 1. 添加新的 IPC 通道
```typescript
// src/shared/constants/ipc-channels.ts
export const IPC_CHANNELS = {
  // 现有通道...
  NEW_FEATURE: {
    GET_DATA: 'new-feature:getData',
    SET_DATA: 'new-feature:setData',
  },
} as const;
```

#### 2. 实现主进程处理器
```typescript
// src/main/ipc/handlers/new-feature.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants/ipc-channels';

export function registerNewFeatureHandlers() {
  ipcMain.handle(IPC_CHANNELS.NEW_FEATURE.GET_DATA, async () => {
    // 处理业务逻辑
    return { success: true, data: {} };
  });
}
```

#### 3. 在预加载脚本中暴露 API
```typescript
// src/preload/preload.ts
const newFeatureAPI = {
  getData: (): Promise<APIResponse> => 
    ipcRenderer.invoke(IPC_CHANNELS.NEW_FEATURE.GET_DATA),
};

// 添加到 electronAPI 中
const electronAPI = {
  // 现有 API...
  newFeature: newFeatureAPI,
};
```

#### 4. 创建渲染进程服务
```typescript
// src/renderer/services/new-feature-api.ts
export const newFeatureAPI = {
  getData: async () => {
    const result = await window.electronAPI.newFeature.getData();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get data');
    }
    return result.data;
  },
};
```

#### 5. 创建自定义 Hook
```typescript
// src/renderer/hooks/useNewFeature.ts
export function useNewFeature() {
  const [data, setData] = useState(null);
  
  const loadData = async () => {
    const result = await newFeatureAPI.getData();
    setData(result);
  };
  
  return { data, loadData };
}
```

### 当前可用功能示例

```typescript
// 在 React 组件中使用
import { useTheme } from '@/hooks/useTheme';
import { useWindow } from '@/hooks/useWindow';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
  const { minimize, maximize, close } = useWindow();
  
  return (
    <div>
      <button onClick={toggleTheme}>
        切换主题 (当前: {theme})
      </button>
      <button onClick={minimize}>最小化</button>
      <button onClick={maximize}>最大化</button>
      <button onClick={close}>关闭</button>
    </div>
  );
}
```

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn
- Git

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/your-username/starepo.git
cd starepo
```

2. **安装依赖**

```bash
npm install
```

3. **环境配置**

创建 `.env` 文件并配置必要的环境变量：

```bash
# 本地数据存储配置（可选）
DATABASE_TYPE=json  # 或 sqlite

# AI 服务配置
# 支持 OpenAI, Anthropic, Google AI 等多种 Provider
OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
# GOOGLE_API_KEY=your_google_api_key
```

#### Personal Access Token 设置

Starepo 使用 Personal Access Token 进行 GitHub 认证：

1. 访问 [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 选择必要的权限范围：
   - `user`: 读取用户信息
   - `repo`: 访问仓库（如需要私有仓库）
   - `read:org`: 读取组织信息
4. 生成 Token 后在应用中配置

5. **初始化数据存储**

```bash
npm run db:init
```

5. **启动应用**

```bash
npm run start
```

### 首次使用

#### GitHub 认证设置

1. **启动应用**：运行 `npm run start` 启动 Starepo
2. **Token 认证流程**：
   - 应用会显示 Token 认证界面
   - 按照应用内指南创建 GitHub Personal Access Token
   - 将 Token 粘贴到输入框中
   - 点击 "验证并连接" 完成认证

#### 数据同步和使用

3. **自动数据同步**：认证完成后，应用会自动开始同步你的 Star 项目
4. **开始对话**：数据同步完成后，即可通过自然语言与 AI 对话查找项目
5. **AI 工具调用**：AI 会自动选择合适的工具来满足你的需求（搜索、筛选、分析等）

#### 功能特性

- **实时同步**：支持增量同步，自动获取新的 Star 项目
- **离线使用**：数据本地存储，支持离线浏览
- **智能工具调用**：AI 自主决定使用哪些工具完成任务
- **多维度搜索**：支持关键词、语言、Star 数、主题等多种搜索方式
- **速率限制监控**：实时显示 GitHub API 使用情况，避免超限

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议

本项目基于 MIT 协议开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 基于 [electron-shadcn](https://github.com/LuanRoger/electron-shadcn) 模板构建
- 感谢 Vercel 团队提供的 AI SDK V5
- 支持多种 AI 提供商：OpenAI、Anthropic、Google AI 等

## 📝 更新日志

### v1.0.0 - 架构重构 (2025-08-21)
- ✅ **完成 Electron 进程分离架构重构**
  - 主进程、渲染进程、预加载脚本完全分离
  - 类型安全的 IPC 通信系统
  - 安全的 Context Isolation 实现
- ✅ **现代化项目结构**
  - 按功能和进程分层的目录结构
  - 模块化的服务层设计
  - 完整的 TypeScript 类型系统
- ✅ **React 集成优化**
  - 自定义 Hooks：useTheme、useWindow
  - API 服务层封装
  - 错误处理和状态管理
- ✅ **开发工具链更新**
  - Vite 配置优化支持新架构
  - ESLint 和 Prettier 配置更新
  - 路径别名和模块解析优化

### 下一步计划
1. **GitHub 数据同步完善** - 增量同步和本地存储优化
2. **Agentic AI 工具系统** - 实现工具注册表和 Tool Calling
3. **搜索工具集开发** - 关键词、语言、Star 数等搜索工具
4. **AI 对话界面** - 流式响应和工具调用可视化

