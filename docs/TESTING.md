# 测试指南

本文档说明如何运行 Starepo 聊天系统的测试。

## 测试结构

```
src/tests/
├── unit/                    # 单元测试
│   ├── main/                # 主进程单元测试
│   │   ├── services/
│   │   │   └── ai/
│   │   │       └── ai-service.test.ts
│   │   └── ipc/
│   │       └── *.test.ts
│   └── renderer/            # 渲染进程单元测试
│       ├── stores/
│       │   └── chat-store.test.ts
│       └── components/
│           └── chat/
│               └── chat-components.test.tsx
├── integration/             # 集成测试
│   └── ipc/
│       └── ai-handlers.test.ts
├── e2e/                     # E2E 测试
│   └── *.spec.ts
├── factories/               # 测试工厂函数
└── helpers/                 # 测试辅助函数
```

## 运行测试

### 运行所有单元测试

```bash
npm test
```

### 运行特定测试文件

```bash
# AIService 测试
npm test -- ai-service.test.ts

# ChatStore 测试
npm test -- chat-store.test.ts

# 组件测试
npm test -- chat-components.test.tsx

# IPC 集成测试
npm test -- ai-handlers.test.ts
```

### 监听模式（开发时使用）

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm test -- --coverage
```

## 测试覆盖范围

### 1. AIService 单元测试

**测试场景**：
- ✅ 正确处理文本流
- ✅ 正确处理工具调用
- ✅ 正确处理错误
- ✅ 支持中断信号
- ✅ 收集仓库引用
- ✅ 未初始化时抛出错误

### 2. ChatStore 单元测试

**测试场景**：
- ✅ 正确初始化助手消息的 parts 数组
- ✅ 正确处理文本流并追加到 TextPart
- ✅ 正确处理工具调用并创建 ToolCallPart
- ✅ 正确处理文本和工具调用混合
- ✅ 保持 content 字段与 parts 同步
- ✅ 正确处理流式错误
- ✅ 支持中断流式会话

### 3. 组件测试

**ToolCallCard**：
- ✅ 正确渲染三种状态（calling/success/error）
- ✅ 显示工具参数和结果

**MessageContentRenderer**：
- ✅ 降级支持
- ✅ 正确渲染混合内容
- ✅ 流式光标动画

### 4. IPC 集成测试

**测试场景**：
- ✅ Handler 注册
- ✅ Session 管理
- ✅ Chunk 推送
- ✅ 中断支持
- ✅ 错误处理
- ✅ 资源清理

## 预期测试结果

```
✓ AIService.streamChat (6 tests)
✓ ChatStore - 流式处理 (8 tests)
✓ ToolCallCard (5 tests)
✓ MessageContentRenderer (5 tests)
✓ IPC 流式通信集成测试 (8 tests)

Test Files  4 passed (4)
     Tests  32 passed (32)
```
