# StarRepo - GitHub Star 智能管理工具

一个基于 Electron 的本地桌面应用，帮助你智能管理和检索 GitHub Star 项目。通过 AI 向量化技术和自然语言对话，让你的 Star 项目不再石沉大海。

## 🌟 核心功能

- **GitHub 集成**: 自动同步你的 GitHub Star 项目信息
- **智能向量化**: 使用 Embedding 技术对项目进行语义理解
- **AI 对话检索**: 通过自然语言快速找到相关项目
- **本地存储**: 使用 ChromaDB 进行本地向量数据库存储
- **离线使用**: 数据完全本地化，保护隐私
- **实时同步**: 支持增量同步最新的 Star 项目

## 🛠️ 技术栈

### 核心框架 🏍️

- [Electron 37](https://www.electronjs.org) - 跨平台桌面应用框架
- [Vite 7](https://vitejs.dev) - 现代化构建工具
- [React 19](https://reactjs.org) - 用户界面库
- [TypeScript 5.8](https://www.typescriptlang.org) - 类型安全的 JavaScript

### AI & 数据处理 🤖

- [ChromaDB](https://www.trychroma.com/) - 本地向量数据库
- [AI SDK V5](https://ai-sdk.dev/) - 统一的 AI 接口，支持多种 AI 提供商
- [GitHub API](https://docs.github.com/en/rest) - GitHub 数据获取

### UI & 用户体验 🎨

- [Tailwind 4](https://tailwindcss.com) - 原子化 CSS 框架
- [Shadcn UI](https://ui.shadcn.com) - 现代化组件库
- [Geist](https://vercel.com/font) - 优雅字体
- [Lucide](https://lucide.dev) - 图标库
- [TanStack Router](https://tanstack.com/router) - 路由管理
- [i18next](https://www.i18next.com) - 国际化支持

### 开发工具 🛠️

- [Prettier](https://prettier.io) - 代码格式化
- [ESLint 9](https://eslint.org) - 代码检查
- [Zod 4](https://zod.dev) - 数据验证
- [React Query (TanStack)](https://react-query.tanstack.com) - 数据状态管理

### 测试框架 🧪

- [Vitest](https://vitest.dev) - 单元测试框架
- [Playwright](https://playwright.dev) - 端到端测试
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) - React 组件测试

### 打包分发 📦

- [Electron Forge](https://www.electronforge.io) - 应用打包和分发

## 🏗️ 功能规划

### Phase 1: 基础功能 (MVP)
- [ ] GitHub OAuth 登录集成
- [ ] Star 项目数据获取和展示
- [ ] 基础的项目信息存储
- [ ] 简单的搜索和筛选功能

### Phase 2: 智能化升级
- [ ] ChromaDB 本地向量数据库集成
- [ ] OpenAI Embedding API 集成
- [ ] 项目描述和 README 向量化
- [ ] 基础的语义搜索功能

### Phase 3: AI 对话系统
- [ ] 聊天界面设计和实现
- [ ] 自然语言查询处理
- [ ] 上下文感知的对话系统
- [ ] 搜索结果智能排序

### Phase 4: 高级功能
- [ ] 项目标签和分类管理
- [ ] 个人笔记和评价系统
- [ ] 数据导出和备份功能
- [ ] 多账户支持
- [ ] 离线模式优化

## 🏛️ 系统架构

### 整体架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端界面      │    │   主进程        │    │   外部服务      │
│                 │    │                 │    │                 │
│ • React UI      │◄──►│ • GitHub API    │◄──►│ • GitHub API    │
│ • Chat 界面     │    │ • ChromaDB      │    │ • OpenAI API    │
│ • 项目列表      │    │ • 数据处理      │    │                 │
│ • 搜索功能      │    │ • IPC 通信      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 数据流程
1. **数据获取**: GitHub API → 项目基础信息
2. **数据处理**: README/描述 → AI SDK Embedding → 向量数据
3. **数据存储**: ChromaDB 本地向量数据库
4. **智能检索**: 用户查询 → 向量相似度搜索 → 结果排序
5. **对话交互**: 自然语言 → 意图识别 → 精准搜索

### 项目配置 🎯

- **安全隔离**: 启用 Context Isolation
- **编译优化**: React Compiler 默认启用
- **界面设计**: 隐藏标题栏，使用自定义标题栏
- **字体选择**: Geist 作为默认字体
- **开发工具**: React DevTools 预装
- **数据安全**: 所有数据本地存储，保护用户隐私

## 📁 项目结构

```plaintext
.
└── ./src/
    ├── ./src/assets/          # 静态资源
    │   └── ./src/assets/fonts/
    ├── ./src/components/      # UI 组件
    │   ├── ./src/components/ui/        # Shadcn UI 组件
    │   ├── ./src/components/chat/      # 聊天相关组件
    │   ├── ./src/components/repo/      # 项目展示组件
    │   └── ./src/components/search/    # 搜索相关组件
    ├── ./src/services/        # 业务服务层
    │   ├── ./src/services/github/     # GitHub API 服务
    │   ├── ./src/services/ai/         # AI 相关服务
    │   ├── ./src/services/database/   # 数据库服务
    │   └── ./src/services/embedding/  # 向量化服务
    ├── ./src/helpers/         # 工具函数
    │   ├── ./src/helpers/ipc/         # IPC 通信
    │   └── ./src/helpers/utils/       # 通用工具
    ├── ./src/stores/          # 状态管理
    │   ├── ./src/stores/auth/         # 认证状态
    │   ├── ./src/stores/repos/        # 项目数据状态
    │   └── ./src/stores/chat/         # 聊天状态
    ├── ./src/pages/           # 页面组件
    │   ├── ./src/pages/dashboard/     # 主面板
    │   ├── ./src/pages/chat/          # 聊天页面
    │   ├── ./src/pages/settings/      # 设置页面
    │   └── ./src/pages/auth/          # 认证页面
    ├── ./src/layouts/         # 布局组件
    ├── ./src/types/           # TypeScript 类型定义
    ├── ./src/styles/          # 全局样式
    └── ./src/tests/           # 测试文件
```

### 目录说明

- **`services/`**: 核心业务逻辑层
  - `github/`: GitHub API 集成，处理 OAuth 认证和数据获取
  - `ai/`: AI 对话和自然语言处理
  - `database/`: ChromaDB 数据库操作
  - `embedding/`: OpenAI Embedding 向量化处理

- **`components/`**: 可复用 UI 组件
  - `chat/`: 聊天界面、消息气泡、输入框等
  - `repo/`: 项目卡片、列表、详情等
  - `search/`: 搜索框、筛选器、结果展示等

- **`stores/`**: 全局状态管理
  - `auth/`: 用户认证状态和 GitHub Token
  - `repos/`: Star 项目数据和缓存
  - `chat/`: 聊天历史和上下文

- **`pages/`**: 主要页面组件
  - `dashboard/`: 项目概览和管理
  - `chat/`: AI 对话检索界面
  - `settings/`: 应用设置和配置

## 🚀 开发脚本

运行脚本命令：

```bash
npm run <script>
```

### 开发和构建
- `start`: 启动开发模式
- `dev`: 开发模式别名
- `build`: 构建生产版本
- `package`: 打包应用程序
- `make`: 生成平台特定的安装包
- `publish`: 发布应用程序

### 代码质量
- `lint`: 运行 ESLint 代码检查
- `lint:fix`: 自动修复 ESLint 问题
- `format`: 检查代码格式（不修改代码）
- `format:write`: 格式化代码
- `type-check`: TypeScript 类型检查

### 测试
- `test`: 运行所有测试
- `test:unit`: 运行单元测试 (Vitest)
- `test:e2e`: 运行端到端测试 (Playwright)
- `test:watch`: 监听模式运行测试

### 数据库和服务
- `db:setup`: 初始化 ChromaDB
- `db:reset`: 重置数据库
- `db:migrate`: 数据库迁移
- `sync:github`: 手动同步 GitHub Stars

> **注意**: 端到端测试需要先构建应用程序，运行测试前请先执行 `npm run package`

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
# GitHub OAuth 配置
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# ChromaDB 配置
CHROMA_DB_PATH=./data/chroma
```

4. **初始化数据库**

```bash
npm run db:setup
```

5. **启动应用**

```bash
npm run start
```

### 首次使用

1. 启动应用后，点击 "连接 GitHub" 进行 OAuth 认证
2. 授权完成后，应用会自动同步你的 Star 项目
3. 等待向量化处理完成（首次可能需要几分钟）
4. 开始使用 AI 对话功能搜索你的 Star 项目！

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
- 感谢 ChromaDB 团队提供的优秀向量数据库
