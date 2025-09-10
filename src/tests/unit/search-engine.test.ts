import { describe, test, expect, beforeEach } from 'vitest';
import { UnifiedSearchEngine, TextAnalyzer, SearchIndexManager } from '@/services/search';
import type { GitHubRepository } from '@/services/github/types';

// 测试数据
const mockRepositories: GitHubRepository[] = [
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
  }
];

describe('TextAnalyzer', () => {
  let analyzer: TextAnalyzer;

  beforeEach(() => {
    analyzer = new TextAnalyzer();
  });

  test('tokenize text correctly', () => {
    const text = 'React is a JavaScript library';
    const tokens = analyzer.tokenize(text);
    
    expect(tokens).toHaveLength(5);
    expect(tokens[0].text).toBe('React');
    expect(tokens[0].normalized).toBe('react');
    expect(tokens[1].text).toBe('is');
  });

  test('normalize tokens correctly', () => {
    expect(analyzer.normalize('JavaScript')).toBe('javascript');
    expect(analyzer.normalize('React.js')).toBe('reactjs');
    expect(analyzer.normalize('Node.js')).toBe('nodejs');
  });

  test('remove stop words', () => {
    const tokens = analyzer.tokenize('This is a React library for building UI');
    const filtered = analyzer.removeStopWords(tokens);
    
    const words = filtered.map(t => t.normalized);
    expect(words).not.toContain('this');
    expect(words).not.toContain('is');
    expect(words).not.toContain('a');
    expect(words).toContain('react');
    expect(words).toContain('library');
  });

  test('calculate text similarity', () => {
    const similarity1 = analyzer.calculateSimilarity('react library', 'react framework');
    const similarity2 = analyzer.calculateSimilarity('react', 'vue');
    
    expect(similarity1).toBeGreaterThan(similarity2);
    expect(similarity1).toBeGreaterThan(0);
    expect(similarity2).toBeGreaterThanOrEqual(0);
  });

  test('generate suggestions', () => {
    const vocabulary = ['react', 'redux', 'typescript', 'javascript', 'vue'];
    const suggestions = analyzer.generateSuggestions('reac', vocabulary, 3);
    
    expect(suggestions).toContain('react');
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe('UnifiedSearchEngine', () => {
  let searchEngine: UnifiedSearchEngine;

  beforeEach(async () => {
    searchEngine = new UnifiedSearchEngine();
    await searchEngine.initialize(mockRepositories);
  });

  test('initialize search engine', () => {
    expect(searchEngine.isReady()).toBe(true);
  });

  test('basic keyword search', async () => {
    const results = await searchEngine.search({
      text: 'react',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].repository.name).toBe('react');
    expect(results[0].type).toBe('keyword');
  });

  test('search with multiple terms', async () => {
    const results = await searchEngine.search({
      text: 'javascript library',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    // React should rank higher as it matches both terms better
    const reactResult = results.find(r => r.repository.name === 'react');
    expect(reactResult).toBeDefined();
  });

  test('field search', async () => {
    const results = await searchEngine.search({
      text: 'owner:facebook',
      type: 'keyword'
    });

    expect(results.length).toBe(1);
    expect(results[0].repository.owner.login).toBe('facebook');
  });

  test('search with filters', async () => {
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        filters: {
          language: 'JavaScript',
          minStars: 100000
        }
      }
    });

    for (const result of results) {
      expect(result.repository.language).toBe('JavaScript');
      expect(result.repository.stargazers_count).toBeGreaterThanOrEqual(100000);
    }
  });

  test('search with limit', async () => {
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        limit: 2
      }
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('fuzzy search', async () => {
    const results = await searchEngine.search({
      text: 'reakt~2', // 模糊搜索 "react"
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    // 应该能找到 "react"
    const reactResult = results.find(r => r.repository.name === 'react');
    expect(reactResult).toBeDefined();
  });

  test('wildcard search', async () => {
    const results = await searchEngine.search({
      text: 'java*',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    // 应该匹配 "javascript"
    const hasJavaScript = results.some(r => 
      r.repository.description?.toLowerCase().includes('javascript') ||
      r.repository.language?.toLowerCase().includes('javascript')
    );
    expect(hasJavaScript).toBe(true);
  });

  test('generate search suggestions', async () => {
    const suggestions = await searchEngine.suggest('reac');
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe('completion');
    expect(suggestions[0].score).toBeGreaterThan(0);
  });

  test('get search statistics', async () => {
    const stats = await searchEngine.getStats();
    
    expect(stats.totalResults).toBe(mockRepositories.length);
    expect(stats.indexSize).toBeGreaterThan(0);
  });

  test('explain search process', async () => {
    const explanation = await searchEngine.explain({
      text: 'react javascript',
      type: 'keyword'
    });

    expect(explanation.query.originalQuery).toBe('react javascript');
    expect(explanation.strategy).toBe('keyword_search');
    expect(explanation.steps.length).toBeGreaterThan(0);
    expect(explanation.totalTime).toBeGreaterThan(0);
  });

  test('update index with new repository', async () => {
    const newRepo: GitHubRepository = {
      id: 4,
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
    };

    await searchEngine.updateIndex(newRepo);

    const results = await searchEngine.search({
      text: 'angular',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].repository.name).toBe('angular');
  });

  test('remove repository from index', async () => {
    await searchEngine.removeFromIndex('1'); // Remove React

    const results = await searchEngine.search({
      text: 'react',
      type: 'keyword'
    });

    // Should not find React anymore
    const reactResult = results.find(r => r.repository.name === 'react');
    expect(reactResult).toBeUndefined();
  });

  test('handle invalid queries', async () => {
    await expect(searchEngine.search({
      text: '',
      type: 'keyword'
    })).rejects.toThrow();

    await expect(searchEngine.search({
      text: 'a'.repeat(1001), // Too long
      type: 'keyword'
    })).rejects.toThrow();
  });

  test('handle unsupported search types', async () => {
    await expect(searchEngine.search({
      text: 'test query',
      type: 'semantic'
    })).rejects.toThrow('语义搜索功能尚未实现');

    await expect(searchEngine.search({
      text: 'test query',
      type: 'conversational'
    })).rejects.toThrow('对话式搜索功能尚未实现');
  });

  test('search with complex queries', async () => {
    // 测试组合查询
    const results = await searchEngine.search({
      text: 'javascript framework owner:facebook',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    const reactResult = results.find(r => r.repository.name === 'react');
    expect(reactResult).toBeDefined();
  });

  test('search with sorting options', async () => {
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        sortBy: 'stars',
        sortOrder: 'desc'
      }
    });

    expect(results.length).toBeGreaterThan(1);
    // 验证按星数降序排列
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].repository.stargazers_count)
        .toBeGreaterThanOrEqual(results[i + 1].repository.stargazers_count);
    }
  });

  test('search with date range filters', async () => {
    const results = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        filters: {
          dateRange: {
            field: 'created',
            start: new Date('2013-01-01'),
            end: new Date('2013-12-31')
          }
        }
      }
    });

    for (const result of results) {
      const createdDate = new Date(result.repository.created_at);
      expect(createdDate.getFullYear()).toBe(2013);
    }
  });

  test('search performance with large query', async () => {
    const startTime = Date.now();
    
    const results = await searchEngine.search({
      text: 'javascript react vue typescript framework library',
      type: 'keyword',
      options: {
        limit: 50
      }
    });

    const searchTime = Date.now() - startTime;
    
    expect(searchTime).toBeLessThan(1000); // 搜索应在1秒内完成
    expect(results.length).toBeGreaterThan(0);
  });

  test('search with case sensitivity', async () => {
    const caseSensitiveResults = await searchEngine.search({
      text: 'JavaScript',
      type: 'keyword',
      options: {
        caseSensitive: true
      }
    });

    const caseInsensitiveResults = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        caseSensitive: false
      }
    });

    // 大小写不敏感应该返回更多结果
    expect(caseInsensitiveResults.length).toBeGreaterThanOrEqual(caseSensitiveResults.length);
  });

  test('search with whole word matching', async () => {
    const wholeWordResults = await searchEngine.search({
      text: 'react',
      type: 'keyword',
      options: {
        wholeWord: true
      }
    });

    const partialWordResults = await searchEngine.search({
      text: 'react',
      type: 'keyword',
      options: {
        wholeWord: false
      }
    });

    expect(wholeWordResults.length).toBeGreaterThan(0);
    expect(partialWordResults.length).toBeGreaterThanOrEqual(wholeWordResults.length);
  });

  test('search result metadata completeness', async () => {
    const results = await searchEngine.search({
      text: 'react javascript',
      type: 'keyword'
    });

    expect(results.length).toBeGreaterThan(0);
    
    const result = results[0];
    expect(result.metadata).toBeDefined();
    expect(result.metadata.matchedFields).toBeDefined();
    expect(result.metadata.relevanceFactors).toBeDefined();
    expect(result.metadata.searchTime).toBeGreaterThanOrEqual(0);
    expect(result.metadata.confidence).toBeGreaterThan(0);
    expect(result.metadata.confidence).toBeLessThanOrEqual(1);
  });

  test('search with offset and pagination', async () => {
    const firstPage = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        limit: 2,
        offset: 0
      }
    });

    const secondPage = await searchEngine.search({
      text: 'javascript',
      type: 'keyword',
      options: {
        limit: 2,
        offset: 2
      }
    });

    expect(firstPage.length).toBeLessThanOrEqual(2);
    expect(secondPage.length).toBeLessThanOrEqual(2);
    
    // 确保分页结果不重复
    const firstPageIds = firstPage.map(r => r.repository.id);
    const secondPageIds = secondPage.map(r => r.repository.id);
    const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
    expect(intersection.length).toBe(0);
  });

  test('concurrent search operations', async () => {
    const queries = [
      'react',
      'vue',
      'typescript',
      'javascript framework'
    ];

    const promises = queries.map(query => 
      searchEngine.search({
        text: query,
        type: 'keyword'
      })
    );

    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('SearchIndexManager', () => {
  let indexManager: SearchIndexManager;

  beforeEach(() => {
    indexManager = new SearchIndexManager();
  });

  test('build index with empty repository list', async () => {
    await indexManager.buildIndex([]);
    
    const stats = indexManager.getIndexStats();
    expect(stats.totalDocuments).toBe(0);
    expect(stats.totalTerms).toBe(0);
  });

  test('serialize and deserialize index', async () => {
    await indexManager.buildIndex(mockRepositories);
    
    const serialized = indexManager.serialize();
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe('string');
    
    const newIndexManager = new SearchIndexManager();
    newIndexManager.deserialize(serialized);
    
    const originalStats = indexManager.getIndexStats();
    const deserializedStats = newIndexManager.getIndexStats();
    
    expect(deserializedStats.totalDocuments).toBe(originalStats.totalDocuments);
    expect(deserializedStats.totalTerms).toBe(originalStats.totalTerms);
  });

  test('calculate TF-IDF scores', async () => {
    await indexManager.buildIndex(mockRepositories);
    
    // 获取实际存在的词项
    const allTerms = indexManager.getAllTerms();
    expect(allTerms.length).toBeGreaterThan(0);
    
    // 使用实际存在的词项测试
    const existingTerm = allTerms[0];
    const score = indexManager.calculateTfIdf(existingTerm, '1');
    expect(score).toBeGreaterThan(0);
    
    // 不存在的词项应该返回0
    const zeroScore = indexManager.calculateTfIdf('nonexistent', '1');
    expect(zeroScore).toBe(0);
  });

  test('field-specific searches', async () => {
    await indexManager.buildIndex(mockRepositories);
    
    const nameTerms = indexManager.getFieldTerms('name');
    const descriptionTerms = indexManager.getFieldTerms('description');
    
    expect(nameTerms.length).toBeGreaterThan(0);
    expect(descriptionTerms.length).toBeGreaterThan(0);
    
    // 字段特定的posting list
    const namePosting = indexManager.getFieldPostingList('name', 'react');
    expect(namePosting).toBeDefined();
    expect(namePosting!.postings.length).toBeGreaterThan(0);
  });
});

describe('TextAnalyzer Advanced Features', () => {
  let analyzer: TextAnalyzer;

  beforeEach(() => {
    analyzer = new TextAnalyzer();
  });

  test('extract N-grams', () => {
    const tokens = analyzer.tokenize('React JavaScript library');
    const bigrams = analyzer.extractNGrams(tokens, 2);
    const trigrams = analyzer.extractNGrams(tokens, 3);
    
    expect(bigrams.length).toBeGreaterThan(0);
    expect(trigrams.length).toBeGreaterThan(0);
    expect(bigrams.length).toBeGreaterThan(trigrams.length);
  });

  test('extract keywords from text', () => {
    const text = 'React is a popular JavaScript library for building user interfaces. It was created by Facebook.';
    const keywords = analyzer.extractKeywords(text, 5);
    
    expect(keywords.length).toBeLessThanOrEqual(5);
    expect(keywords[0].score).toBeGreaterThan(0);
    
    // 关键词应该按分数降序排列
    for (let i = 0; i < keywords.length - 1; i++) {
      expect(keywords[i].score).toBeGreaterThanOrEqual(keywords[i + 1].score);
    }
  });

  test('handle different token types', () => {
    const tokens = analyzer.tokenize('React 2024 @facebook #javascript');
    
    const wordTokens = tokens.filter(t => t.type === 'word');
    const numberTokens = tokens.filter(t => t.type === 'number');
    const symbolTokens = tokens.filter(t => t.type === 'symbol');
    
    expect(wordTokens.length).toBeGreaterThan(0);
    expect(numberTokens.length).toBeGreaterThan(0);
    expect(symbolTokens.length).toBeGreaterThan(0);
  });

  test('stemming consistency', () => {
    const words = ['running', 'runs', 'ran'];
    const stems = words.map(word => analyzer.stem(word));
    
    // 相关词应该有相似的词干
    expect(stems[0]).toBe(stems[1]); // running, runs
  });

  test('cache performance', () => {
    const word = 'javascript';
    
    // 第一次调用
    const stem1 = analyzer.stem(word);
    
    // 第二次调用应该使用缓存
    const stem2 = analyzer.stem(word);
    
    expect(stem1).toBe(stem2);
    
    const cacheStats = analyzer.getCacheStats();
    expect(cacheStats.size).toBeGreaterThan(0);
  });

  test('clear cache functionality', () => {
    analyzer.stem('test');
    expect(analyzer.getCacheStats().size).toBeGreaterThan(0);
    
    analyzer.clearCache();
    expect(analyzer.getCacheStats().size).toBe(0);
  });
});