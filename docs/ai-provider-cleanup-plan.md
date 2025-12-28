# AI Provider 旧代码清理计划

## 📋 可清理的文件

### 1. 旧的 Adapters 目录 ✅ 可删除
**位置**: `src/main/services/ai/adapters/`

**文件列表**:
- `anthropic-adapter.ts` - 已迁移到 `providers/adapters/`
- `openai-compatible-adapter.ts` - 已迁移到 `providers/adapters/`
- `base-adapter.ts` - 已迁移到 `providers/adapters/base/`
- `provider-registry.ts` - 已被新的动态注册表替代
- `index.ts` - 旧的导出文件

**状态**: ✅ 已完全迁移，可以安全删除

---

### 2. 旧的 AI Service ⚠️ 建议保留 2 周
**位置**: `src/main/services/ai/ai-service.ts`

**原因**:
- 目前在 `index.ts` 中仍然导出（向后兼容）
- 可能有外部代码依赖
- 建议观察期后再删除

**清理时间**: 2025-01-11 (2 周后)

---

### 3. 旧的 IPC Handlers ⚠️ 建议保留 2 周
**位置**: `src/main/ipc/ai-handlers.ts`

**原因**:
- 作为回滚备份
- 如果新架构出现问题可以快速恢复

**清理时间**: 2025-01-11 (2 周后)

---

### 4. 未使用的导入 ✅ 可立即清理
**位置**: `src/main/services/ai/model-discovery-service.ts:7`

```typescript
import { AIService } from './ai-service';  // 未使用，可删除
```

**状态**: ✅ 可以立即删除

---

## 🗑️ 清理步骤

### 阶段 1: 立即清理 (今天)

#### 1.1 删除旧 adapters 目录
```bash
rm -rf src/main/services/ai/adapters/
```

#### 1.2 清理未使用的导入
```typescript
// model-discovery-service.ts
// 删除第 7 行
- import { AIService } from './ai-service';
```

#### 1.3 更新导出文件
```typescript
// src/main/services/ai/index.ts
// 移除旧的 adapters 导出
- export * from './adapters';
```

---

### 阶段 2: 观察期后清理 (2025-01-11)

#### 2.1 删除旧的 AI Service
```bash
rm src/main/services/ai/ai-service.ts
```

#### 2.2 删除旧的 IPC Handlers
```bash
rm src/main/ipc/ai-handlers.ts
```

#### 2.3 更新导出文件
```typescript
// src/main/services/ai/index.ts
// 移除旧版本导出
- export { AIService } from './ai-service';
- export function getAIService(): AIService { ... }
- export function setAIService(service: AIService | null): void { ... }
```

#### 2.4 更新 IPC index
```typescript
// src/main/ipc/index.ts
// 移除旧版本导入
- import { initializeAIHandlers, setAIService } from "./ai-handlers";
- import { AIService, ... } from "../services/ai";
```

---

## ⚠️ 清理前检查清单

### 必须确认
- [ ] 新架构已在生产环境运行至少 2 周
- [ ] 没有发现严重 bug 或性能问题
- [ ] 用户反馈良好
- [ ] 所有功能测试通过
- [ ] 有完整的 Git 历史记录可以回滚

### 可选确认
- [ ] 性能指标符合预期
- [ ] 内存使用正常
- [ ] 没有内存泄漏
- [ ] 日志中没有异常错误

---

## 🛡️ 安全措施

### 1. Git 备份
在删除前创建备份分支：
```bash
git checkout -b backup/old-ai-architecture
git push origin backup/old-ai-architecture
```

### 2. 文档备份
保存旧代码的文档：
```bash
mkdir -p docs/archive/old-architecture
cp src/main/services/ai/ai-service.ts docs/archive/old-architecture/
cp src/main/ipc/ai-handlers.ts docs/archive/old-architecture/
```

### 3. 回滚计划
如果需要回滚：
```bash
git checkout backup/old-ai-architecture -- src/main/services/ai/ai-service.ts
git checkout backup/old-ai-architecture -- src/main/ipc/ai-handlers.ts
# 恢复 IPC 注册
```

---

## 📊 预期收益

### 代码清理
- **删除文件**: 7 个
- **删除代码行**: ~1500 行
- **减少维护成本**: 30-40%

### 目录结构
清理后的目录结构更清晰：
```
src/main/services/ai/
├── core/              # 核心层
├── providers/         # Provider 层
├── storage/           # 存储层
├── ai-service-v2.ts   # 新服务
└── index.ts           # 导出
```

---

## 🎯 建议

### 立即执行
1. ✅ 删除旧 adapters 目录
2. ✅ 清理未使用的导入
3. ✅ 创建 Git 备份分支

### 2 周后执行
4. ⏳ 删除旧 AI Service
5. ⏳ 删除旧 IPC Handlers
6. ⏳ 更新所有导出文件

### 最终清理
7. ⏳ 重命名 `AIServiceV2` → `AIService`
8. ⏳ 重命名 `ai-handlers-v2.ts` → `ai-handlers.ts`
9. ⏳ 更新所有引用

---

## 📝 清理日志

### 2025-12-28
- [x] 创建清理计划
- [ ] 执行阶段 1 清理
- [ ] 创建 Git 备份分支

### 2025-01-11 (计划)
- [ ] 执行阶段 2 清理
- [ ] 验证应用正常运行
- [ ] 更新文档

---

## ✅ 总结

**建议策略**: 渐进式清理

1. **立即清理**: 已迁移的 adapters 目录和未使用的导入
2. **观察期**: 保留旧服务和 handlers 2 周作为安全网
3. **最终清理**: 2 周后删除所有旧代码

这样既能保持代码整洁，又能确保有足够的回滚余地。

**下一步**: 执行阶段 1 清理？
