# Starepo

用语义搜索检索你的 GitHub Star 仓库。

[English](./README.md) | 简体中文

## 功能特性

- 🔍 **语义搜索** - 基于本地向量嵌入的自然语言查询
- 🖥️ **交互式浏览** - 直接运行 `starepo`，进入边输入边搜索、带预览面板的全屏界面
- ⚡ **快速关键词搜索** - 全文搜索兜底，结果即时返回
- 🔃 **灵活排序** - 按 star 数、fork 数、star 时间、更新时间排序
- 🔐 **零配置认证** - GitHub Device Flow 授权，无需手动填写 Token
- 💾 **本地存储** - 所有数据通过 LanceDB 存储在本地（无需编译）
- 🌍 **多语言支持** - 支持中文、英文等多种语言查询

## 安装

需要 Node.js 22.12 或更高版本。

```bash
npm install -g starepo
```

或直接用 `npx`（无需安装）：

```bash
npx starepo <命令>
```

## Agent 集成（skills.sh）

通过一条命令将 starepo 技能安装到 Claude Code、Cursor 等 AI Agent：

```bash
npx skills add yangyang0507/starepo
```

安装后，AI Agent 可以直接检索你的 GitHub Star，直接用自然语言提问即可：

> "帮我找和语义搜索相关的 star"
> "列出这个月 star 的 TypeScript 项目"

## 快速开始

### 1. GitHub 授权

```bash
starepo auth
```

starepo 会显示一次性授权码并复制到剪贴板；按回车打开 GitHub 设备授权页，粘贴授权码并确认即可。

### 2. 同步 Star

```bash
# 全量对齐（新 star、metadata、取消 star）
starepo sync

# 仅拉取上次同步之后的新 star
starepo sync --incremental

# 跳过向量生成（速度更快）
starepo sync --no-embeddings
```

### 3. 搜索

不带参数运行 `starepo` 即可进入交互式浏览：输入即搜索，`↑↓` 移动，`Enter` 在浏览器中打开。

```bash
# 语义搜索（自然语言）
starepo search "react 状态管理库"
starepo search "ai 设计工具"

# 带结构化过滤的搜索
starepo search "react" --lang TypeScript --topic hooks
starepo search --query "state" --since 2026-03-01 --until 2026-03-08
starepo search --lang TypeScript --days 7

# 限制结果数量
starepo search "python web 框架" --limit 5

# 排序
starepo search "rust cli" --sort stars
starepo search "react" --sort forks --order asc

# JSON 输出
starepo search "rust cli" --json

# 单行紧凑结果
starepo search "rust cli" --oneline
```

## 命令说明

### `auth`

GitHub 授权（首次使用时自动触发）。

```bash
starepo auth
starepo auth --force  # 重新授权
```

### `sync`

同步 GitHub Star 仓库。

```bash
starepo sync                  # 全量对齐（新 star、metadata、取消 star）
starepo sync --incremental    # 只拉取上次同步之后的新 star
starepo sync --force          # 与默认全量对齐相同
starepo sync --no-embeddings  # 跳过向量生成
```

**说明：** 首次同步会为每个仓库生成向量嵌入（约 0.5s/个）。1000+ star 约需 10 分钟。

### `embed`

生成或重新生成语义搜索向量。

```bash
starepo embed          # 仅生成缺失的向量
starepo embed --force  # 重新生成全部向量
```

**适用场景：**
- 恢复中断的向量生成
- 升级到新的嵌入模型
- 修复损坏的向量数据

### `browse [query]`

全屏交互式搜索。在终端里直接运行 `starepo` 打开的就是它；在脚本或管道中不带参数运行会打印帮助，这类场景请用 `search --json`。

```bash
starepo              # 等同于 `starepo browse`
starepo browse "向量数据库"
```

| 按键 | 操作 |
|---|---|
| 直接输入 | 即时按关键词过滤；停顿片刻后由语义搜索结果替换 |
| `↑` `↓` / `Ctrl-P` `Ctrl-N` | 移动选中项（`PgUp` `PgDn` `Home` `End` 快速跳转） |
| `Enter` | 在浏览器中打开选中的仓库 |
| `Ctrl-Y` | 复制仓库链接 |
| `Tab` | 切换排序：相关度 → 最近 Star → Star 数 → 最近更新 |
| `Ctrl-W` / `Ctrl-U` | 删除一个词 / 清空查询 |
| `Esc` | 清空查询；再按一次退出（`Ctrl-C` 随时退出） |

终端宽度 ≥ 100 列时右侧显示预览面板（描述、topics、时间）；更窄时在列表下方用一行显示选中项的描述。

### `search [query]`

搜索 Star 仓库。

```bash
starepo search "query"
starepo search --query "query"
starepo search "query" --limit 10
starepo search "query" --lang TypeScript --topic react
starepo search "query" --since 2026-03-01 --until 2026-03-08
starepo search --lang TypeScript --days 7
starepo search "query" --sort stars              # 按 star 数降序
starepo search "query" --sort forks --order asc  # 按 fork 数升序
starepo search "query" --json
starepo search "query" --oneline
```

在终端里不带查询和过滤条件运行 `starepo search` 会打开交互式浏览界面（见 `browse`）。

**搜索模式：**
- 有向量数据时：**混合搜索**（向量 + 关键词，Reciprocal Rank Fusion 排序）
- 无向量数据时：**关键词搜索**（全文检索兜底）

**排序字段（`--sort`）：** `relevance`（默认）、`stars`、`forks`、`starred`、`updated`

**排序方向（`--order`）：** `desc`（默认）、`asc`

### `list`

列出 Star 仓库，支持过滤。

```bash
starepo list
starepo list --query "react"
starepo list --lang TypeScript
starepo list --topic ai
starepo list --since 2026-03-01 --until 2026-03-08
starepo list --days 7
starepo list --limit 20
starepo list --sort stars                 # 按 star 数降序
starepo list --sort starred --order asc   # 最早 star 的在前
starepo list --sort updated               # 最近更新的在前
starepo list --json
starepo list --oneline
```

**排序字段（`--sort`）：** `starred`（默认）、`stars`、`forks`、`updated`

**排序方向（`--order`）：** `desc`（默认）、`asc`

### `info <owner/repo>`

查看仓库详细信息。

```bash
starepo info facebook/react
```

### `status`

查看本地授权、数据库、同步和向量覆盖状态。

```bash
starepo status
starepo status --json
```

## 配置存储

所有数据遵循 XDG 规范存储在本地：

- **配置**：`~/.config/starepo/`
  - `auth.json` - GitHub Token
  - `meta.json` - 同步元数据
- **数据**：`~/.local/share/starepo/`
  - `lancedb/` - LanceDB 向量数据库

## 架构

### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 语言 | TypeScript (Node.js) | 类型安全的 CLI 开发 |
| GitHub API | `@octokit/rest` | 官方 SDK，支持分页 |
| 认证 | `@octokit/auth-oauth-device` | CLI 友好的 Device Flow |
| 存储 | `@lancedb/lancedb` | 无需编译的向量数据库 |
| 向量嵌入 | `@huggingface/transformers` | 本地运行，支持离线 |
| CLI | `commander` | 轻量、类型安全 |

### 搜索策略

**L1：关键词搜索（FTS）**
- LanceDB INVERTED 索引，覆盖名称/描述/话题
- 索引不可用时降级为过滤搜索
- 即时返回，零依赖

**L2：向量搜索**
- 本地向量嵌入，基于量化版 `Xenova/bge-m3` q8（1024 维，首次使用约缓存 550 MB）
- 余弦相似度排序
- 支持自然语言和多语言查询

**L3：混合搜索**
- 用 Reciprocal Rank Fusion 合并向量 + 关键词结果
- 去重并按融合后的相关性重排
- 兼顾精准与语义

## 开发

```bash
# 克隆仓库
git clone https://github.com/yangyang0507/starepo.git
cd starepo

# 安装依赖
npm install

# 构建
npm run build

# 开发模式（tsx）
npm run dev -- search "query"

# 类型检查
npx tsc --noEmit

# 本地测试
npm link
starepo --help
```

## 常见问题

### 从 1.x 升级

Starepo 2.0 需要 Node.js 22.12+，并已移除 `starepo serve`。Agent 请改用 CLI 或 starepo skill。

LanceDB 已升级到 0.38。如果 `starepo search` 或 `starepo sync` 打不开本地数据库，删除后重新同步：

```bash
rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/starepo/lancedb"
starepo sync --force
```

已有的 FTS 索引会在下次搜索时自动重建。

### 搜索无结果

运行 `starepo sync` 确保：
1. 数据已从 GitHub 同步
2. 向量已生成（首次同步自动完成，或之后运行 `starepo embed`）

### 首次同步较慢

向量生成约 0.5s/个，1000+ star 时：
- 使用 `--no-embeddings` 加速首次同步
- 之后运行 `starepo embed` 补充向量

### 全局安装后命令找不到

确保 npm 全局 bin 目录在 PATH 中：
```bash
npm config get prefix
# 将 <prefix>/bin 添加到 PATH
```

## 许可证

MIT

## 致谢

基于以下开源项目构建：
- [LanceDB](https://github.com/lancedb/lancedb) - 现代向量数据库
- [Transformers.js](https://github.com/huggingface/transformers.js) - 本地 ML 推理
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API 客户端
