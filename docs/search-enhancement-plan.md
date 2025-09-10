# Starepo 搜索功能增强开发计划

> P2.2 阶段 - 搜索功能增强详细实施方案

## 📋 项目概览

### 当前搜索功能分析

**现有功能**:
- ✅ 基础关键词搜索（仓库名、描述、作者、主题）
- ✅ 语言筛选
- ✅ 主题筛选  
- ✅ 星标数范围筛选
- ✅ 排序功能（名称、星标数、创建/更新时间）
- ✅ 搜索防抖（300ms）

**存在问题**:
- ❌ 搜索功能较为基础，只支持简单的包含匹配
- ❌ 缺乏高级搜索语法支持
- ❌ 没有搜索历史记录
- ❌ 缺乏搜索建议和自动完成
- ❌ 无法保存和管理搜索条件
- ❌ 搜索结果高亮显示不足

## 🎯 增强目标

### 1. 全文搜索增强
- 实现模糊搜索和智能匹配
- 支持高级搜索语法
- 添加搜索结果高亮
- 实现搜索权重排序

### 2. 高级筛选选项
- 可视化筛选器构建
- 预设筛选条件
- 自定义筛选规则
- 筛选条件组合逻辑

### 3. 搜索历史记录
- 本地搜索历史存储
- 搜索建议和自动完成
- 热门搜索推荐
- 搜索统计分析

## 🚀 功能规划

### Phase 1: 全文搜索增强 (3天)

#### 1.1 智能搜索算法
```typescript
interface SearchOptions {
  fuzzy: boolean;           // 模糊匹配
  caseSensitive: boolean;   // 大小写敏感
  wholeWord: boolean;       // 全词匹配
  regex: boolean;           // 正则表达式
  weight: SearchWeight;     // 搜索权重配置
}

interface SearchWeight {
  name: number;        // 仓库名权重
  description: number; // 描述权重
  topics: number;      // 主题权重
  owner: number;       // 作者权重
  readme: number;      // README权重（未来扩展）
}
```

#### 1.2 高级搜索语法
```
基础语法:
- "exact phrase"     # 精确短语匹配
- word1 AND word2    # 逻辑与
- word1 OR word2     # 逻辑或
- NOT word           # 逻辑非
- word*              # 通配符匹配

字段搜索:
- name:react         # 仓库名包含react
- desc:component     # 描述包含component
- topic:javascript   # 主题包含javascript
- owner:facebook     # 作者为facebook
- lang:typescript    # 语言为typescript
- stars:>1000        # 星标数大于1000
- updated:>2024      # 更新时间在2024年后

组合搜索:
- name:react AND lang:typescript
- (topic:ui OR topic:component) AND stars:>500
```

#### 1.3 搜索结果高亮
- 关键词高亮显示
- 匹配片段摘要
- 相关度评分显示

### Phase 2: 高级筛选器 (2天)

#### 2.1 可视化筛选构建器
```typescript
interface FilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number | boolean;
  logic?: 'AND' | 'OR';
}

interface FilterGroup {
  id: string;
  name: string;
  rules: FilterRule[];
  logic: 'AND' | 'OR';
}

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  groups: FilterGroup[];
  createdAt: Date;
  usageCount: number;
}
```

#### 2.2 预设筛选条件
```typescript
const PRESET_FILTERS = {
  trending: {
    name: "热门项目",
    rules: [
      { field: "stars", operator: ">", value: 1000 },
      { field: "updated", operator: ">", value: "2024-01-01" }
    ]
  },
  recent: {
    name: "最近更新",
    rules: [
      { field: "updated", operator: ">", value: "last-month" }
    ]
  },
  frontend: {
    name: "前端项目", 
    rules: [
      { field: "language", operator: "in", value: ["JavaScript", "TypeScript", "Vue", "React"] }
    ]
  }
};
```

#### 2.3 筛选器UI组件
- 拖拽式筛选规则构建
- 实时预览筛选结果
- 筛选条件保存和管理
- 筛选器分享功能

### Phase 3: 搜索历史与建议 (2天)

#### 3.1 搜索历史管理
```typescript
interface SearchHistory {
  id: string;
  query: string;
  filters: FilterOptions;
  timestamp: Date;
  resultCount: number;
  executionTime: number;
}

interface SearchSuggestion {
  text: string;
  type: 'history' | 'popular' | 'completion';
  frequency: number;
  lastUsed: Date;
}
```

#### 3.2 智能建议系统
- 基于历史的搜索建议
- 热门搜索推荐
- 自动完成功能
- 拼写纠错建议

#### 3.3 搜索分析
- 搜索频率统计
- 热门关键词分析
- 搜索效果评估
- 用户搜索行为分析

## 🏗️ 技术实现

### 1. 搜索引擎核心

#### 1.1 搜索服务架构
```typescript
// src/renderer/services/search/search-engine.ts
export class SearchEngine {
  private index: SearchIndex;
  private analyzer: TextAnalyzer;
  private ranker: SearchRanker;

  search(query: string, options: SearchOptions): SearchResult[];
  buildIndex(repositories: GitHubRepository[]): void;
  updateIndex(repository: GitHubRepository): void;
}

// src/renderer/services/search/text-analyzer.ts
export class TextAnalyzer {
  tokenize(text: string): Token[];
  normalize(tokens: Token[]): Token[];
  stemming(tokens: Token[]): Token[];
}

// src/renderer/services/search/search-ranker.ts
export class SearchRanker {
  rank(results: SearchResult[], query: string): SearchResult[];
  calculateRelevance(result: SearchResult, query: string): number;
}
```

#### 1.2 搜索索引结构
```typescript
interface SearchIndex {
  documents: Map<string, IndexedDocument>;
  invertedIndex: Map<string, PostingList>;
  fieldIndex: Map<string, Map<string, PostingList>>;
}

interface IndexedDocument {
  id: string;
  fields: Map<string, string>;
  tokens: Token[];
  metadata: DocumentMetadata;
}

interface PostingList {
  term: string;
  documents: DocumentPosting[];
}

interface DocumentPosting {
  documentId: string;
  frequency: number;
  positions: number[];
  fieldBoost: number;
}
```

### 2. 状态管理扩展

#### 2.1 搜索状态Store
```typescript
// src/renderer/stores/search-store.ts
interface SearchStore {
  // 搜索状态
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  searchTime: number;
  
  // 历史记录
  history: SearchHistory[];
  suggestions: SearchSuggestion[];
  
  // 高级筛选
  activeFilters: FilterGroup[];
  savedFilters: SavedFilter[];
  
  // 搜索配置
  searchOptions: SearchOptions;
  
  // Actions
  search: (query: string, options?: SearchOptions) => Promise<void>;
  addToHistory: (query: string, resultCount: number) => void;
  getSuggestions: (input: string) => SearchSuggestion[];
  saveFilter: (filter: SavedFilter) => void;
  loadFilter: (filterId: string) => void;
}
```

#### 2.2 与现有UIStore集成
```typescript
// 扩展现有的 ui-store.ts
interface UIStore {
  // 现有状态...
  
  // 新增搜索相关状态
  searchMode: 'simple' | 'advanced';
  showSearchHistory: boolean;
  showFilterBuilder: boolean;
  searchResultsLayout: 'list' | 'grid' | 'compact';
  
  // 新增Actions
  setSearchMode: (mode: 'simple' | 'advanced') => void;
  toggleSearchHistory: () => void;
  toggleFilterBuilder: () => void;
}
```

### 3. 组件架构

#### 3.1 搜索组件层次结构
```
SearchContainer
├── SearchInput
│   ├── SearchSuggestions
│   ├── SearchHistory
│   └── SearchSyntaxHelper
├── FilterBuilder
│   ├── FilterRuleEditor
│   ├── FilterPresets
│   └── SavedFilters
├── SearchResults
│   ├── ResultsHeader
│   ├── ResultsList
│   └── ResultsPagination
└── SearchAnalytics
    ├── SearchStats
    └── PopularQueries
```

#### 3.2 核心组件设计

##### SearchInput 组件
```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  suggestions: SearchSuggestion[];
  history: SearchHistory[];
  showAdvanced?: boolean;
}
```

##### FilterBuilder 组件
```typescript
interface FilterBuilderProps {
  filters: FilterGroup[];
  onChange: (filters: FilterGroup[]) => void;
  presets: SavedFilter[];
  onSaveFilter: (filter: SavedFilter) => void;
}
```

##### SearchResults 组件
```typescript
interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  totalCount: number;
  searchTime: number;
  layout: 'list' | 'grid' | 'compact';
}
```

### 4. 数据持久化

#### 4.1 本地存储策略
```typescript
// src/renderer/services/storage/search-storage.ts
export class SearchStorage {
  // 搜索历史
  saveSearchHistory(history: SearchHistory[]): Promise<void>;
  loadSearchHistory(): Promise<SearchHistory[]>;
  
  // 保存的筛选器
  saveSavedFilters(filters: SavedFilter[]): Promise<void>;
  loadSavedFilters(): Promise<SavedFilter[]>;
  
  // 搜索配置
  saveSearchOptions(options: SearchOptions): Promise<void>;
  loadSearchOptions(): Promise<SearchOptions>;
  
  // 搜索统计
  saveSearchStats(stats: SearchStats): Promise<void>;
  loadSearchStats(): Promise<SearchStats>;
}
```

#### 4.2 IndexedDB 数据结构
```typescript
// 数据库结构
const DB_SCHEMA = {
  searchHistory: {
    keyPath: 'id',
    indexes: ['timestamp', 'query', 'resultCount']
  },
  savedFilters: {
    keyPath: 'id', 
    indexes: ['name', 'createdAt', 'usageCount']
  },
  searchStats: {
    keyPath: 'date',
    indexes: ['queryCount', 'popularTerms']
  }
};
```

## 📱 用户界面设计

### 1. 搜索界面布局

#### 1.1 简单搜索模式
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 [搜索框________________] [🔧] [📊] [⚙️]              │
│    ↳ 搜索建议下拉                                       │
├─────────────────────────────────────────────────────────┤
│ 快速筛选: [全部] [前端] [后端] [移动端] [AI/ML] [工具]   │
├─────────────────────────────────────────────────────────┤
│ 搜索结果 (123 个结果，用时 0.05s)                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [仓库卡片 - 高亮显示匹配关键词]                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 1.2 高级搜索模式
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 [搜索框________________] [简单模式] [📊] [⚙️]         │
├─────────────────────────────────────────────────────────┤
│ 筛选器构建器:                                           │
│ ┌─ 筛选组 1 ─────────────────────────────────────────┐  │
│ │ [仓库名] [包含] [react___________] [AND] [➕] [❌]  │  │
│ │ [语言__] [等于] [TypeScript____] [AND] [➕] [❌]   │  │
│ │ [星标数] [大于] [1000__________] [___] [➕] [❌]   │  │
│ └─────────────────────────────────────────────────────┘  │
│ [➕ 添加筛选组] [💾 保存筛选器] [📂 加载预设]          │
├─────────────────────────────────────────────────────────┤
│ 搜索结果...                                             │
└─────────────────────────────────────────────────────────┘
```

### 2. 搜索历史界面
```
┌─────────────────────────────────────────────────────────┐
│ 搜索历史                                    [清空历史]  │
├─────────────────────────────────────────────────────────┤
│ 📅 今天                                                │
│ • react typescript component (23 结果) - 14:30         │
│ • vue3 composition api (45 结果) - 13:15               │
│                                                         │
│ 📅 昨天                                                │
│ • nodejs express api (67 结果) - 16:45                 │
│ • python machine learning (89 结果) - 10:20            │
│                                                         │
│ 🔥 热门搜索                                            │
│ • react • typescript • vue • nodejs • python          │
└─────────────────────────────────────────────────────────┘
```

### 3. 筛选器管理界面
```
┌─────────────────────────────────────────────────────────┐
│ 我的筛选器                                  [➕ 新建]   │
├─────────────────────────────────────────────────────────┤
│ 📌 前端热门项目                             [编辑][删除] │
│    语言: JS/TS/Vue/React, 星标>1000                     │
│    使用次数: 15 次                                      │
│                                                         │
│ 📌 最近活跃项目                             [编辑][删除] │
│    更新时间: 最近30天, 星标>100                         │
│    使用次数: 8 次                                       │
│                                                         │
│ 🌟 系统预设                                             │
│ • 热门项目 • 最新项目 • 前端项目 • 后端项目             │
└─────────────────────────────────────────────────────────┘
```

## 🧪 测试策略

### 1. 单元测试

#### 1.1 搜索引擎测试
```typescript
// src/tests/unit/search-engine.test.ts
describe('SearchEngine', () => {
  test('基础关键词搜索', () => {
    // 测试简单关键词匹配
  });
  
  test('高级语法搜索', () => {
    // 测试 AND/OR/NOT 逻辑
  });
  
  test('字段搜索', () => {
    // 测试 name:, desc:, topic: 等字段搜索
  });
  
  test('模糊搜索', () => {
    // 测试拼写错误容忍
  });
  
  test('搜索权重排序', () => {
    // 测试相关度排序
  });
});
```

#### 1.2 筛选器测试
```typescript
// src/tests/unit/filter-builder.test.ts
describe('FilterBuilder', () => {
  test('筛选规则构建', () => {
    // 测试筛选规则的创建和验证
  });
  
  test('筛选器保存和加载', () => {
    // 测试筛选器持久化
  });
  
  test('预设筛选器应用', () => {
    // 测试预设筛选器功能
  });
});
```

### 2. 集成测试

#### 2.1 搜索流程测试
```typescript
// src/tests/integration/search-flow.test.ts
describe('搜索功能集成测试', () => {
  test('完整搜索流程', async () => {
    // 1. 输入搜索关键词
    // 2. 应用筛选条件
    // 3. 验证搜索结果
    // 4. 检查历史记录
  });
  
  test('搜索性能测试', async () => {
    // 测试大量数据下的搜索性能
  });
});
```

### 3. E2E 测试

#### 3.1 用户搜索场景
```typescript
// src/tests/e2e/search-scenarios.test.ts
describe('搜索用户场景', () => {
  test('新用户首次搜索', async () => {
    // 模拟新用户的搜索体验
  });
  
  test('高级用户复杂搜索', async () => {
    // 模拟高级用户使用复杂筛选器
  });
  
  test('搜索历史管理', async () => {
    // 测试搜索历史的完整生命周期
  });
});
```

## 📊 性能指标

### 1. 搜索性能目标
- **搜索响应时间**: < 100ms (1000个仓库)
- **索引构建时间**: < 500ms (1000个仓库)
- **内存使用**: < 50MB (搜索索引)
- **存储空间**: < 10MB (历史记录和缓存)

### 2. 用户体验指标
- **搜索准确率**: > 95%
- **搜索建议响应**: < 50ms
- **界面响应时间**: < 200ms
- **搜索满意度**: > 4.5/5

### 3. 功能覆盖指标
- **搜索语法支持**: 100% 计划功能
- **筛选器类型**: 15+ 种筛选条件
- **历史记录容量**: 1000+ 条记录
- **预设筛选器**: 10+ 个常用预设

## 📅 开发时间线

### Week 1: 核心搜索引擎 (3天)
- **Day 1**: 搜索引擎架构设计和基础实现
- **Day 2**: 高级搜索语法解析和执行
- **Day 3**: 搜索结果排序和高亮显示

### Week 2: 高级筛选功能 (2天)  
- **Day 4**: 筛选器构建器UI组件
- **Day 5**: 预设筛选器和保存功能

### Week 3: 历史记录和优化 (2天)
- **Day 6**: 搜索历史记录和建议系统
- **Day 7**: 性能优化和测试完善

## 🔧 技术依赖

### 新增依赖包
```json
{
  "fuse.js": "^7.0.0",           // 模糊搜索库
  "lunr": "^2.3.9",              // 全文搜索引擎
  "date-fns": "^3.0.0",          // 日期处理
  "lodash.debounce": "^4.0.8",   // 防抖函数
  "react-highlight-words": "^0.20.0" // 关键词高亮
}
```

### 开发工具
```json
{
  "@types/lunr": "^2.3.7",      // Lunr类型定义
  "benchmark": "^2.1.4",        // 性能基准测试
  "faker": "^8.0.0"             // 测试数据生成
}
```

## 🚀 部署和发布

### 1. 渐进式发布策略
- **Alpha版本**: 内部测试，核心搜索功能
- **Beta版本**: 小范围用户测试，收集反馈
- **正式版本**: 全量发布，包含所有功能

### 2. 功能开关
```typescript
// 功能开关配置
const FEATURE_FLAGS = {
  advancedSearch: true,      // 高级搜索
  searchHistory: true,       // 搜索历史
  filterBuilder: true,       // 筛选器构建器
  searchAnalytics: false,    // 搜索分析（后续版本）
};
```

### 3. 监控和反馈
- 搜索性能监控
- 用户行为分析
- 错误日志收集
- 用户反馈收集

---

## 📝 总结

这个搜索功能增强计划将显著提升 Starepo 的用户体验，通过智能搜索、高级筛选和历史记录功能，帮助用户更高效地管理和发现 GitHub 仓库。

**预期收益**:
- 🔍 搜索效率提升 300%
- 📊 用户满意度提升 40%
- 💾 搜索历史复用率 60%
- 🎯 搜索准确率 > 95%

**下一步行动**:
1. 确认技术方案和UI设计
2. 创建开发分支开始实施
3. 设置性能监控和测试环境
4. 制定详细的测试计划

让我们开始构建更强大的搜索体验！🚀