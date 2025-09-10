/**
 * 搜索引擎配置
 */

import type { SearchEngineConfig, FieldWeights, SearchWeights } from './types';

export const DEFAULT_FIELD_WEIGHTS: FieldWeights = {
  name: 2.0,        // 仓库名称权重最高
  description: 1.5, // 描述权重中等
  topics: 1.8,      // 主题标签权重较高
  owner: 1.2,       // 所有者权重较低
  readme: 1.0       // README权重基准（未来扩展）
};

export const DEFAULT_SEARCH_WEIGHTS: SearchWeights = {
  keyword: 0.7,     // 关键词搜索权重
  semantic: 0.3,    // 语义搜索权重（未来使用）
  popularity: 0.2,  // 流行度权重
  recency: 0.1      // 时效性权重
};

export const DEFAULT_SEARCH_CONFIG: SearchEngineConfig = {
  // 索引配置
  indexing: {
    batchSize: 100,           // 批处理大小
    maxDocuments: 10000,      // 最大文档数
    fieldWeights: DEFAULT_FIELD_WEIGHTS
  },
  
  // 搜索配置
  search: {
    defaultLimit: 20,         // 默认返回结果数
    maxLimit: 100,            // 最大返回结果数
    timeout: 5000,            // 搜索超时时间(ms)
    fuzzyThreshold: 0.7       // 模糊搜索阈值
  },
  
  // 缓存配置
  cache: {
    enabled: true,            // 启用缓存
    maxSize: 1000,            // 最大缓存条目数
    ttl: 300000               // 缓存TTL(ms) - 5分钟
  },
  
  // 性能配置
  performance: {
    enableParallelSearch: true,    // 启用并行搜索
    indexUpdateThrottle: 100,      // 索引更新节流(ms)
    searchThrottle: 50             // 搜索节流(ms)
  }
};

/**
 * 创建自定义搜索配置
 */
export function createSearchConfig(overrides?: Partial<SearchEngineConfig>): SearchEngineConfig {
  return {
    indexing: {
      ...DEFAULT_SEARCH_CONFIG.indexing,
      ...overrides?.indexing
    },
    search: {
      ...DEFAULT_SEARCH_CONFIG.search,
      ...overrides?.search
    },
    cache: {
      ...DEFAULT_SEARCH_CONFIG.cache,
      ...overrides?.cache
    },
    performance: {
      ...DEFAULT_SEARCH_CONFIG.performance,
      ...overrides?.performance
    }
  };
}

/**
 * 验证搜索配置
 */
export function validateSearchConfig(config: SearchEngineConfig): string[] {
  const errors: string[] = [];

  // 验证索引配置
  if (config.indexing.batchSize <= 0) {
    errors.push('索引批处理大小必须大于0');
  }
  
  if (config.indexing.maxDocuments <= 0) {
    errors.push('最大文档数必须大于0');
  }

  // 验证搜索配置
  if (config.search.defaultLimit <= 0) {
    errors.push('默认结果限制必须大于0');
  }
  
  if (config.search.maxLimit < config.search.defaultLimit) {
    errors.push('最大结果限制不能小于默认限制');
  }
  
  if (config.search.timeout <= 0) {
    errors.push('搜索超时时间必须大于0');
  }
  
  if (config.search.fuzzyThreshold < 0 || config.search.fuzzyThreshold > 1) {
    errors.push('模糊搜索阈值必须在0-1之间');
  }

  // 验证缓存配置
  if (config.cache.maxSize <= 0) {
    errors.push('缓存最大大小必须大于0');
  }
  
  if (config.cache.ttl <= 0) {
    errors.push('缓存TTL必须大于0');
  }

  return errors;
}

/**
 * 搜索引擎预设配置
 */
export const SEARCH_PRESETS = {
  // 高性能配置 - 适合大量数据
  performance: createSearchConfig({
    indexing: {
      batchSize: 200,
      maxDocuments: 20000
    },
    search: {
      defaultLimit: 50,
      maxLimit: 200,
      timeout: 10000
    },
    cache: {
      maxSize: 2000,
      ttl: 600000 // 10分钟
    },
    performance: {
      enableParallelSearch: true,
      indexUpdateThrottle: 50,
      searchThrottle: 25
    }
  }),

  // 内存优化配置 - 适合资源受限环境
  memory: createSearchConfig({
    indexing: {
      batchSize: 50,
      maxDocuments: 5000
    },
    search: {
      defaultLimit: 10,
      maxLimit: 50,
      timeout: 3000
    },
    cache: {
      maxSize: 500,
      ttl: 180000 // 3分钟
    },
    performance: {
      enableParallelSearch: false,
      indexUpdateThrottle: 200,
      searchThrottle: 100
    }
  }),

  // 开发配置 - 适合开发和调试
  development: createSearchConfig({
    indexing: {
      batchSize: 20,
      maxDocuments: 1000
    },
    search: {
      defaultLimit: 10,
      maxLimit: 50,
      timeout: 1000
    },
    cache: {
      enabled: false,
      maxSize: 100,
      ttl: 60000 // 1分钟
    },
    performance: {
      enableParallelSearch: false,
      indexUpdateThrottle: 500,
      searchThrottle: 300
    }
  })
};

/**
 * 根据环境获取推荐配置
 */
export function getRecommendedConfig(): SearchEngineConfig {
  // 在实际应用中可以根据系统资源、数据量等因素选择配置
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return SEARCH_PRESETS.development;
  }

  // 简单的性能检测（实际应用中可以更复杂）
  const memoryGB = (navigator as any).deviceMemory || 4;
  const isHighPerformance = memoryGB >= 8;

  return isHighPerformance ? SEARCH_PRESETS.performance : SEARCH_PRESETS.memory;
}