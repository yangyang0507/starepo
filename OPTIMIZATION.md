# Starepo 优化清单

> 综合两轮独立代码审查（Claude + Codex）的分析结果，去重整合后按优先级排序。

---

## 分类说明

为避免把“已经确认会产生错误结果的问题”和“可能提升效果的优化尝试”混在一起，本清单分为两类：

- **Confirmed issues**：已从当前实现中确认存在的问题，应作为修复和重构主线
- **Optimization experiments**：方向合理，但更偏排序质量、召回质量或表示质量优化，不应先于正确性问题处理

---

## Confirmed issues

## 已完成

- 已完成：检索管线的过滤和排序不再建立在过早截断的候选集之上
- 已完成：移除搜索热路径中的 embedding 全表扫描，改为缓存和 metadata 驱动
- 已完成：FTS 索引初始化移出查询热路径
- 已完成：full sync 会清理已 unstar 的本地残留仓库
- 已完成：高风险路径已补回归测试
- 已完成：时间字段已增加数值列 `starred_at_ts` / `updated_at_ts`
- 已完成：topics 已增加规范化列 `topics_text`
- 已完成：过滤和候选收窄已尽量下推到存储层
- 已完成：embedding 生成已改为小并发 worker 池
- 已完成：embedding 已支持批量写入、模型/版本 metadata 和恢复提示
- 已完成：CLI / MCP / README 的版本和 `sync_stars(incremental)` 契约已对齐

---

## 🔴 P0：必须优先修复的正确性/热路径问题

### 1. 检索管线的过滤和排序发生在截断之后

| | |
|---|---|
| **来源** | Claude #6 + Codex #1（Codex 将其提升为最高优先级） |
| **文件** | `src/lib/search.ts` · `src/lib/storage.ts` · `src/commands/search.ts` · `src/commands/list.ts` |

**问题：**

`hybridSearch()` 先取 `candidateLimit = max(limit * 5, 50)` 条候选，**然后**才在内存里做 `language`、`topic`、时间过滤和排序。

```ts
const candidateLimit = Math.max(limit * 5, 50);
// ...
return applyFilters(dedup([...vectorResults, ...ftsResults]), filters).slice(0, limit);
```

- 当过滤条件严格时，有效结果可能在候选截断阶段就被丢弃了
- `--sort stars` / `--sort forks` / `--sort updated` 只在候选集上排序，不是全局正确的
- 过滤后结果远少于 `limit` 时，不会自动补充候选

**Codex 的洞察：** 这不仅是性能问题，更是**正确性问题**。用户看到的排序和过滤结果可能是不完整和误导性的。

**优化方向：**

- 将 `filter + sort + limit` 尽量下推到存储/查询层
- 区分“相关性排序”和“业务排序”（stars/forks/updated），后者应在全量匹配集上执行
- 避免“先截断，后排序”的模式

**状态：** 已完成。过滤职责已下推到存储层，搜索层不再对结构化过滤做第二遍不一致的内存过滤；候选扩容也已按过滤后规模收窄。

---

### 2. 每次搜索都触发全表扫描判断 embedding 是否存在

| | |
|---|---|
| **来源** | Claude #1 + #2，Codex #2（两方一致认为高优先级） |
| **文件** | `src/lib/search.ts:59` · `src/lib/storage.ts:210` |

**问题：**

`hybridSearch()` 调用 `getReposWithoutEmbedding()` 来判断“是否有 embedding”。该函数会拉取全部记录到内存，逐行检查 vector 是否为零向量。

```ts
// search.ts — 每次搜索都触发
const withoutEmbedding = await getReposWithoutEmbedding();
const hasEmbeddings = withoutEmbedding.length < count;

// storage.ts — 全量加载 + JS filter
const results = await table.query().toArray() as unknown as Repo[];
return results.filter(r => vec.every(v => v === 0));
```

**影响：**

- 对 1000+ stars 用户，每次搜索都产生全表扫描
- 读取了大量 vector 数据，而这只是为了判断功能是否可用
- 热路径延迟会随着数据量线性变差

**优化方向：**

- **短期止血：** 可用模块级缓存减少重复判断，但这不是最终方案
- **正式方案：** 增加 `has_embedding` 布尔字段，或将 embedding 状态存入 metadata
- 将 `getReposWithoutEmbedding()` 限制在 `embed` 和 `sync` 工作流中，从搜索热路径移除

**状态：** 已完成。当前通过进程缓存和 metadata 中的 `has_embeddings` 驱动热路径判断，并将全表扫描限制在必要场景。

---

### 3. FTS 索引在每次搜索时尝试重建

| | |
|---|---|
| **来源** | Claude #3，Codex #3（两方一致） |
| **文件** | `src/lib/storage.ts:132` |

**问题：** `searchFTS()` 每次调用都 `try createIndex`，依赖 catch `"already exists"` 错误。

```ts
await (table as any).createIndex('fts_idx', { ... });
```

- 查询执行路径混入了 schema/索引初始化逻辑
- 基于异常的控制流在热路径上不合适
- 并发调用时可能产生竞态

**优化方向：**

- **短期止血：** 用模块级变量缓存索引创建状态
- **正式方案：** 将 FTS 索引创建放到表初始化、首次 sync 或 migration 步骤中
- 查询路径只做查询，不做初始化

**状态：** 已完成。索引初始化已移出查询主流程，并改为按需初始化加缓存。

---

## 🟡 P1：数据一致性、查询模型与回归保护

### 4. Unstar 的仓库不会被清理

| | |
|---|---|
| **来源** | Claude #7（Codex 未提及） |
| **文件** | `src/commands/sync.ts` |

**问题：** 全量 sync 只做 upsert，不处理删除。取消 star 后本地数据库会保留过期数据。

**为什么优先级上调：**

- 这不是单纯的体验问题，而是本地数据与 GitHub 实际星标集合不一致
- 对 `full sync` 的语义来说，这属于数据正确性问题
- 紧急程度低于搜索错误结果，但高于纯性能优化

**优化方向：**

- 全量 sync 后对比本地与远程 ID 集合，删除已不在 GitHub 上的 star
- 将“全量同步会对齐远程状态”作为明确语义固定下来

**状态：** 已完成。full sync 现在会清理 stale repos，远端为空时也会清空本地缓存。

---

### 5. 存储模型限制了查询效率和可下推性

| | |
|---|---|
| **来源** | Codex #4 + Claude #9（Claude 只关注了 SQL 转义，Codex 视角更系统） |
| **文件** | `src/lib/storage.ts` |

**问题：**

- `topics` 存为 JSON 字符串，过滤只能用 `LIKE`
- `starred_at` 和 `updated_at` 存为字符串，时间过滤在 JavaScript 中完成
- `listRepos()` 全量加载后再在内存过滤
- SQL 值手动 `.replace(/'/g, "''")` 转义，不统一

```ts
// JSON 字符串 + LIKE 过滤
conditions.push(`topics LIKE '%${topic.replace(/'/g, "''")}%'`);

// 时间字段在 JS 中过滤
const starredAt = repo.starred_at ? new Date(repo.starred_at).getTime() : NaN;
```

**优化方向：**

- 时间字段改为数值型 timestamp，支持 DB 层过滤和排序
- topics 归一化为更友好的查询结构
- 统一封装查询辅助函数，减少手动转义
- 减少 `toArray()` 之后再做 JS 过滤的场景

**状态：** 部分完成。

- 已完成：`starred_at_ts` / `updated_at_ts`
- 已完成：`topics_text`
- 已完成：过滤和候选规模下推
- 未完成：业务排序仍主要在 JS 层，尚未进一步下推
- 未完成：仍未引入更系统的索引/迁移策略来支持未来更多字段演进

---

### 6. 高风险路径缺少回归测试

| | |
|---|---|
| **来源** | Codex #7（Claude 未提及） |
| **文件** | `tests/search.test.ts` · `tests/storage.test.ts` |

**缺失覆盖：**

- “先截断后过滤” vs “先过滤后截断” 的行为差异
- `--sort stars` / `--sort forks` / `--sort updated` 在搜索模式下的正确性
- `sync --incremental` 边界条件
- MCP 工具 `search_stars`、`list_stars`、`sync_stars` 的行为

**为什么放在 P1：**

- 它不是直接的运行时 bug，但属于大改前必须补的保护网
- search/storage/sync 的后续修改都会高概率触发这里的回归

**优化方向：**

- 在重构 search/storage 之前先补回归测试
- 重点覆盖结果完整性、排序正确性和协议行为

**状态：** 已完成。search/storage/sync/version/serve 等关键路径已补回归覆盖。

---

## 🟢 P2：吞吐、一致性与产品打磨

### 7. Embedding 生成串行 + 逐条写 DB

| | |
|---|---|
| **来源** | Claude #4，Codex #5（两方一致） |
| **文件** | `src/lib/embeddings.ts:52` · `src/commands/sync.ts` |

**问题：**

```ts
for (const repo of repos) {
  const vector = await generateEmbedding(repoToText(repo));
  await updateEmbedding(repo.full_name, vector);  // 逐条写 DB
}
```

**优化方向：**

- **Claude：** 批量生成（可并发），批量写入 DB
- **Codex：** 2-4 个 worker 并发；存储 `embedding_model` + `embedding_version` 元数据以支持模型升级；改善中断/恢复的进度报告

**状态：** 已完成。

- 已完成：小并发 worker 池
- 已完成：批量写入 DB
- 已完成：`embedding_model` / `embedding_version` 元数据
- 已完成：更清晰的恢复/升级提示与 `embed --force` 重建路径

---

### 8. CLI、MCP、文档三方不一致

| | |
|---|---|
| **来源** | Claude #8 + Codex #6 |
| **文件** | `package.json` · `src/index.ts` · `src/commands/serve.ts` · `README.md` |

**问题：**

- `package.json` 版本 `0.3.0`，但 CLI 和 MCP server 硬编码 `0.1.0`
- MCP `sync_stars` 工具缺少增量同步选项（CLI 已支持 `--incremental`）
- 文档描述的 MCP resources 与实际暴露的不完全一致

**优化方向：**

- 版本号从 `package.json` 统一读取，不硬编码
- MCP `sync_stars` 增加 `incremental` 参数
- 文档、CLI 输出、MCP 能力保持同步

**状态：** 已完成。版本来源已统一，`sync_stars(incremental)` 已接入，README 也已同步。

---

## Optimization experiments

以下问题方向合理，但不应先于 Confirmed issues 处理。

## 🟢 P2：可实验的质量优化

### 9. Hybrid Search 缺少相关性重排

| | |
|---|---|
| **来源** | Claude #5（Codex 未提及） |
| **文件** | `src/lib/search.ts:70` |

**问题：** 向量结果和 FTS 结果直接拼接去重，FTS 结果天然排在后面，没有按相关性融合。

```ts
dedup([...vectorResults, ...ftsResults])
```

**为什么降级到实验项：**

- 它影响排序质量，但不构成当前最核心的正确性缺陷
- 当前更紧迫的问题是“候选被过早截断导致漏结果”

**优化方向：**

- 实现 **RRF（Reciprocal Rank Fusion）** 算法，根据两路结果中各自的排名融合得分
- 在引入前先定义评估方式，避免复杂度增加但收益不明确

**状态：** 未开始。

---

### 10. `repoToText` Embedding 文本表示可优化

| | |
|---|---|
| **来源** | Claude #10（Codex 未提及） |
| **文件** | `src/lib/embeddings.ts:33` |

**问题：** `full_name` 和 `name` 高度重叠，description 和 topics 才是语义核心。

```ts
[repo.name, repo.full_name, repo.description, topics, repo.language].join(' ')
```

**为什么降级到实验项：**

- 当前没有证据表明它是现阶段效果问题的主因
- 它更像 embedding 表示质量的调优项，应放在主线修复之后

**优化方向：**

- 用结构化前缀（如 `"description: ... topics: ..."`）或重复核心字段来做简单加权
- 若要修改，建议配合一组固定查询样本评估前后效果

**状态：** 未开始。

---

## 两份报告对比（修订版）

| 发现 | Claude | Codex | 备注 |
|------|:------:|:-----:|------|
| 检索过滤/排序在截断后执行 | 🟡 中 | 🔴 **最高** | Codex 将其定性为正确性 bug，而非仅性能问题 |
| 全表扫描判断 embedding | 🔴 高 | 🔴 高 | 两方一致 |
| FTS 索引每次重建 | 🔴 高 | 🔴 高 | 两方一致 |
| Hybrid Search 无 RRF 重排 | 🟡 中 | — | Claude 独有，更适合作为实验性优化 |
| 存储模型限制查询效率 | 🟢 低（仅 SQL 转义） | 🟡 中（系统性分析） | Codex 分析更深入 |
| Embedding 串行生成 | 🟡 中 | 🟡 中 | 两方一致，Codex 额外建议模型版本管理 |
| repoToText 文本优化 | 🟢 低 | — | Claude 独有，更适合作为实验项 |
| Unstar 不清理 | 🟢 低 | — | Claude 独有，但属于数据一致性问题，应高于纯体验项 |
| CLI/MCP/文档不一致 | 🟢 低 | 🟢 低 | 两方一致，Codex 发现了版本号硬编码 |
| 缺少回归测试 | — | 🟢 低 | Codex 独有 |

---

## 建议执行顺序

1. **继续完成存储模型的剩余工作**（#5）——重点是业务排序能力和后续 schema/index 演进策略
2. **继续提升 embedding 吞吐**（#7）——批量写入、模型版本元数据、恢复策略
3. **最后再做实验型优化**（#9、#10）——RRF 和 `repoToText` 调优
