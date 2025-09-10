/**
 * 搜索引擎集成测试
 * 测试搜索引擎与其他组件的集成
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { UnifiedSearchEngine, createSearchEngine } from '@/services/search';
import type { GitHubRepository } from '@/services/github/types';

// 更大的测试数据集
const largeTestDataset: GitHubRepository[] = [
  {
    id: 1,
    name: 'react',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    owner: { login: 'facebook', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/facebook/react',
    stargazers_count: 200000,
    language: 'JavaScript',
    topics: ['javascript', 'react', 'frontend', 'ui'],
    created_at: '2013-05-24T16:15:54Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 2,
    name: 'vue',
    description: 'The Progressive JavaScript Framework',
    owner: { login: 'vuejs', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/vuejs/vue',
    stargazers_count: 150000,
    language: 'JavaScript',
    topics: ['javascript', 'vue', 'frontend', 'framework'],
    created_at: '2013-07-29T03:24:51Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 3,
    name: 'angular',
    description: 'The modern web developer\'s platform',
    owner: { login: 'angular', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/angular/angular',
    stargazers_count: 80000,
    language: 'TypeScript',
    topics: ['angular', 'typescript', 'frontend'],
    created_at: '2014-09-18T16:12:01Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 4,
    name: 'typescript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
    owner: { login: 'microsoft', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/microsoft/typescript',
    stargazers_count: 90000,
    language: 'TypeScript',
    topics: ['typescript', 'javascript', 'compiler', 'language'],
    created_at: '2012-10-01T15:33:39Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 5,
    name: 'nodejs',
    description: 'Node.js JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
    owner: { login: 'nodejs', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/nodejs/node',
    stargazers_count: 95000,
    language: 'JavaScript',
    topics: ['nodejs', 'javascript', 'runtime', 'server'],
    created_at: '2009-05-27T09:03:01Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 6,
    name: 'express',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    owner: { login: 'expressjs', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/expressjs/express',
    stargazers_count: 60000,
    language: 'JavaScript',
    topics: ['express', 'nodejs', 'web', 'framework'],
    created_at: '2010-01-03T23:05:40Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 7,
    name: 'webpack',
    description: 'A bundler for javascript and friends.',
    owner: { login: 'webpack', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/webpack/webpack',
    stargazers_count: 64000,
    language: 'JavaScript',
    topics: ['webpack', 'bundler', 'javascript', 'build'],
    created_at: '2012-03-10T15:51:42Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  },
  {
    id: 8,
    name: 'vite',
    description: 'Next generation frontend tooling. It\'s fast!',
    owner: { login: 'vitejs', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/vitejs/vite',
    stargazers_count: 55000,
    language: 'TypeScript',
    topics: ['vite', 'build', 'frontend', 'fast'],
    created_at: '2020-04-21T13:47:13Z',
    updated_at: '2024-01-01T12:00:00Z',
    archived: false,
    fork: false
  }
];

describe('Search Engine Integration Tests', () => {
  let searchEngine: UnifiedSearchEngine;

  beforeEach(async () => {
    searchEngine = createSearchEngine({
      indexing: {
        batchSize: 50,
        maxDocuments: 1000,
        fieldWeights: {
          name: 2.0,
          description: 1.5,
          topics: 1.8,
          owner: 1.2
        }
      }
    });
    await searchEngine.initialize(largeTestDataset);
  });

  afterEach(() => {
    searchEngine.dispose();
  });

  test('end-to-end search workflow', async () => {
    // 1. 执行搜索
    const results = await searchEngine.search({
      text: 'javascript framework',
      type: 'keyword',
      options: {
        limit: 5,
        sortBy: 'stars',
        sortOrder: 'desc'
      }
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    // 2. 验证结果按星数排序
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].repository.stargazers_count)
        .toBeGreaterThanOrEqual(results[i + 1].repository.stargazers_count);
    }

    // 3. 验证结果包含相关仓库
    const resultNames = results.map(r => r.repository.name);
    expect(resultNames).toContain('react');
    expect(resultNames).toContain('vue');

    // 4. 验证搜索元数据
    results.forEach(result => {
      expect(result.metadata).toBeDefined();
      expect(result.metadata.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  test('complex filtering and search', async () => {
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        filters: {
          language: 'JavaScript',
          minStars: 50000,
          dateRange: {
            field: 'created',
            start: new Date('2010-01-01'),
            end: new Date('2015-12-31')
          }
        },
        sortBy: 'created',
        sortOrder: 'asc'
      }
    });

    // 验证筛选条件
    results.forEach(result => {
      expect(result.repository.language).toBe('JavaScript');
      expect(result.repository.stargazers_count).toBeGreaterThanOrEqual(50000);
      
      const createdDate = new Date(result.repository.created_at);
      expect(createdDate.getFullYear()).toBeGreaterThanOrEqual(2010);
      expect(createdDate.getFullYear()).toBeLessThanOrEqual(2015);
    });

    // 验证按创建时间升序排列
    for (let i = 0; i < results.length - 1; i++) {
      const date1 = new Date(results[i].repository.created_at);
      const date2 = new Date(results[i + 1].repository.created_at);
      expect(date1.getTime()).toBeLessThanOrEqual(date2.getTime());
    }
  });

  test('search suggestions and autocomplete', async () => {
    // 测试不同长度的输入
    const inputs = ['j', 'ja', 'jav', 'java', 'javascript'];
    
    for (const input of inputs) {
      const suggestions = await searchEngine.suggest(input, 5);
      
      if (input.length >= 2) {
        expect(suggestions.length).toBeGreaterThan(0);
        
        // 验证建议的相关性
        suggestions.forEach(suggestion => {
          expect(suggestion.text.toLowerCase()).toContain(input.toLowerCase());
          expect(suggestion.score).toBeGreaterThan(0);
          expect(suggestion.type).toBe('completion');
        });
      }
    }
  });

  test('real-time index updates', async () => {
    // 添加新仓库
    const newRepo: GitHubRepository = {
      id: 9,
      name: 'svelte',
      description: 'Cybernetically enhanced web apps',
      owner: { login: 'sveltejs', avatar_url: '', html_url: '' },
      html_url: 'https://github.com/sveltejs/svelte',
      stargazers_count: 70000,
      language: 'JavaScript',
      topics: ['svelte', 'javascript', 'frontend', 'compiler'],
      created_at: '2016-11-20T16:15:54Z',
      updated_at: '2024-01-01T12:00:00Z',
      archived: false,
      fork: false
    };

    await searchEngine.updateIndex(newRepo);

    // 验证新仓库可以被搜索到
    const results = await searchEngine.search({
      text: 'svelte',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].repository.name).toBe('svelte');

    // 删除仓库
    await searchEngine.removeFromIndex('9');

    // 验证仓库已被删除
    const resultsAfterRemoval = await searchEngine.search({
      text: 'svelte',
      type: 'keyword'
    });

    const svelteResult = resultsAfterRemoval.find(r => r.repository.name === 'svelte');
    expect(svelteResult).toBeUndefined();
  });

  test('search performance under load', async () => {
    const queries = [
      'javascript',
      'typescript',
      'framework',
      'frontend',
      'build tool',
      'web development',
      'nodejs express',
      'react vue angular'
    ];

    const startTime = Date.now();
    
    // 并发执行多个搜索
    const promises = queries.map(query => 
      searchEngine.search({
        text: query,
        type: 'keyword',
        options: { limit: 10 }
      })
    );

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    // 验证性能
    expect(totalTime).toBeLessThan(2000); // 总时间应少于2秒
    expect(results).toHaveLength(queries.length);

    // 验证每个搜索都返回了结果
    results.forEach((result, index) => {
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      console.log(`Query "${queries[index]}" returned ${result.length} results`);
    });
  });

  test('search statistics and analytics', async () => {
    // 执行几次搜索
    await searchEngine.search({ text: 'javascript', type: 'keyword' });
    await searchEngine.search({ text: 'typescript', type: 'keyword' });
    await searchEngine.search({ text: 'framework', type: 'keyword' });

    const stats = await searchEngine.getStats();

    expect(stats.totalResults).toBe(largeTestDataset.length);
    expect(stats.indexSize).toBeGreaterThan(0);
    expect(stats.searchTime).toBeGreaterThanOrEqual(0);
  });

  test('search explanation and debugging', async () => {
    const explanation = await searchEngine.explain({
      text: 'javascript framework frontend',
      type: 'keyword'
    });

    expect(explanation.query.originalQuery).toBe('javascript framework frontend');
    expect(explanation.strategy).toBe('keyword_search');
    expect(explanation.steps.length).toBeGreaterThan(0);
    expect(explanation.totalTime).toBeGreaterThan(0);

    // 验证解释步骤
    const stepNames = explanation.steps.map(step => step.step);
    expect(stepNames).toContain('query_parsing');
    expect(stepNames).toContain('term_lookup');

    // 验证每个步骤都有时间记录
    explanation.steps.forEach(step => {
      expect(step.time).toBeGreaterThan(0);
      expect(step.description).toBeDefined();
    });
  });

  test('error handling and recovery', async () => {
    // 测试无效查询
    await expect(searchEngine.search({
      text: '',
      type: 'keyword'
    })).rejects.toThrow();

    await expect(searchEngine.search({
      text: 'a'.repeat(1001),
      type: 'keyword'
    })).rejects.toThrow();

    // 测试不支持的搜索类型
    await expect(searchEngine.search({
      text: 'test',
      type: 'semantic'
    })).rejects.toThrow();

    // 验证搜索引擎仍然正常工作
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
  });

  test('configuration and customization', async () => {
    // 创建自定义配置的搜索引擎
    const customEngine = createSearchEngine({
      search: {
        defaultLimit: 3,
        maxLimit: 10,
        timeout: 1000,
        fuzzyThreshold: 0.8
      },
      indexing: {
        fieldWeights: {
          name: 3.0,    // 提高名称权重
          description: 1.0,
          topics: 2.0,
          owner: 0.5
        }
      }
    });

    await customEngine.initialize(largeTestDataset);

    const results = await customEngine.search({
      text: 'react',
      type: 'keyword'
    });

    // 验证配置生效
    expect(results.length).toBeLessThanOrEqual(3); // 默认限制为3

    // 验证名称匹配的权重更高
    const reactResult = results.find(r => r.repository.name === 'react');
    expect(reactResult).toBeDefined();
    expect(reactResult!.score).toBeGreaterThan(0);

    customEngine.dispose();
  });
});

describe('Search Engine Stress Tests', () => {
  test('large dataset handling', async () => {
    // 创建大量测试数据
    const largeDataset: GitHubRepository[] = [];
    
    for (let i = 0; i < 100; i++) {
      largeDataset.push({
        id: i + 1000,
        name: `repo-${i}`,
        description: `Test repository ${i} for JavaScript development`,
        owner: { login: `user-${i}`, avatar_url: '', html_url: '' },
        html_url: `https://github.com/user-${i}/repo-${i}`,
        stargazers_count: Math.floor(Math.random() * 10000),
        language: i % 2 === 0 ? 'JavaScript' : 'TypeScript',
        topics: ['test', 'javascript', `topic-${i % 10}`],
        created_at: new Date(2020 + (i % 4), (i % 12) + 1, (i % 28) + 1).toISOString(),
        updated_at: '2024-01-01T12:00:00Z',
        archived: false,
        fork: i % 10 === 0
      });
    }

    const searchEngine = createSearchEngine();
    const startTime = Date.now();
    
    await searchEngine.initialize(largeDataset);
    
    const indexTime = Date.now() - startTime;
    console.log(`Indexed ${largeDataset.length} repositories in ${indexTime}ms`);
    
    expect(indexTime).toBeLessThan(5000); // 索引时间应少于5秒

    // 测试搜索性能
    const searchStart = Date.now();
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: { limit: 20 }
    });
    const searchTime = Date.now() - searchStart;
    
    console.log(`Search completed in ${searchTime}ms, found ${results.length} results`);
    expect(searchTime).toBeLessThan(1000); // 搜索时间应少于1秒
    expect(results.length).toBeGreaterThan(0);

    searchEngine.dispose();
  });
});