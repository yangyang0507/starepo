# LobeHub Chat UI 集成指南

本文档说明如何使用 LobeHub UI 组件库重构聊天界面。

## 📦 已安装的组件

项目已安装 `@lobehub/ui@4.4.0`，包含以下 Chat 相关组件：

### 核心组件

1. **ChatList** - 聊天消息列表
   - 自动滚动
   - 虚拟滚动支持
   - 加载状态
   - 历史消息计数

2. **ChatItem** - 单条消息项
   - 用户/助手消息样式
   - 头像显示
   - 时间戳
   - 错误状态
   - 加载动画

3. **ChatInputArea** - 输入区域
   - 多行文本输入
   - 发送/停止按钮
   - 加载状态
   - 快捷键支持

4. **Markdown** - Markdown 渲染
   - 代码高亮（Shiki）
   - GFM 支持
   - 数学公式
   - Mermaid 图表

## 🎨 新版聊天界面

### 文件位置

- **新版本**: `src/renderer/components/chat/chat-interface-v2.tsx`
- **旧版本**: `src/renderer/components/chat/chat-interface.tsx`（保留）

### 使用方法

```typescript
import { ChatInterfaceV2 } from '@/components/chat';

// 在路由中使用
<ChatInterfaceV2 conversationId="default" />
```

### 主要改进

1. **统一的设计语言**
   - 使用 LobeHub 官方组件
   - 专业的 AI 聊天界面
   - 一致的视觉风格

2. **更好的 Markdown 渲染**
   - 内置代码高亮
   - 优雅的排版
   - 自动深色模式

3. **优化的交互体验**
   - 流畅的滚动
   - 清晰的加载状态
   - 直观的操作反馈

4. **工具调用支持**
   - 保留自定义 ToolCallCard
   - 通过 `extra` 属性集成
   - 完美融入消息流

## 🔧 类型定义

### ChatMessage 格式

```typescript
interface LobeChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createAt: number;
  updateAt: number;
  error?: {
    message: string;
    type: 'error';
  };
  extra?: ReactNode; // 工具调用等额外内容
  meta?: {
    avatar: ReactNode;
    title: string;
  };
}
```

### 消息转换逻辑

```typescript
// 从应用消息格式转换为 LobeHub 格式
const chatMessages: LobeChatMessage[] = messages.map((msg) => ({
  id: msg.id,
  content: msg.content,
  role: msg.role === "user" ? "user" : "assistant",
  createAt: msg.timestamp,
  updateAt: msg.timestamp,
  error: msg.error ? { message: msg.error, type: "error" } : undefined,
  extra: renderToolCalls(msg.parts), // 工具调用
  meta: {
    avatar: msg.role === "user" ? <User /> : <Bot />,
    title: msg.role === "user" ? "你" : "AI 助手",
  },
}));
```

## 🚀 迁移步骤

### 1. 更新路由

```typescript
// src/renderer/routes/chat.tsx
import { ChatInterfaceV2 } from '@/components/chat';

export function ChatPage() {
  return <ChatInterfaceV2 conversationId="default" />;
}
```

### 2. 测试功能

- [ ] 消息发送和接收
- [ ] 流式输出显示
- [ ] 工具调用卡片
- [ ] Markdown 渲染
- [ ] 错误处理
- [ ] 停止生成
- [ ] 历史记录切换

### 3. 样式调整（如需要）

LobeHub UI 使用自己的样式系统，如需自定义：

```typescript
<ChatList
  data={chatMessages}
  className="custom-chat-list"
  style={{ /* 自定义样式 */ }}
/>
```

## 📚 参考资源

- **LobeHub UI 文档**: https://ui.lobehub.com/
- **Chat 组件**: https://ui.lobehub.com/components/chat/chat-list
- **Markdown 组件**: https://ui.lobehub.com/components/markdown
- **GitHub**: https://github.com/lobehub/lobe-ui

## ⚠️ 注意事项

### 类型兼容性

由于 LobeHub UI 的类型定义可能与项目不完全匹配，当前版本存在一些类型错误。这些错误不影响运行时功能，但需要：

1. **临时方案**: 使用 `// @ts-ignore` 或 `as any` 绕过类型检查
2. **长期方案**: 创建类型适配层或向 LobeHub 提交 PR

### ChatInputArea 问题

`ChatInputArea` 的 API 可能与文档不一致，需要查看实际类型定义：

```bash
cat node_modules/@lobehub/ui/es/chat/ChatInputArea/type.d.mts
```

## 🎯 下一步

1. **修复类型错误** - 创建类型适配层
2. **测试所有功能** - 确保功能完整性
3. **优化性能** - 虚拟滚动、懒加载
4. **添加更多功能** - 消息编辑、删除、复制等

## 💡 提示

如果遇到问题，可以：

1. 查看 LobeHub UI 源码
2. 参考 LobeChat 项目实现
3. 在 GitHub 提 Issue
4. 回退到旧版本 ChatInterface
