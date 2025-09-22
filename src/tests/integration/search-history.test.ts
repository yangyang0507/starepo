import { describe, test, expect, beforeEach } from 'vitest';
import { UnifiedSearchEngine } from '@/services/search';
import type { GitHubRepository } from '@/services/github/types';
import { defaultStorage } from '@/services/storage/browser';

// 测试数据
const mockRepositories: GitHubRepository[] = [
  {
    id: 1,
    name: 'test-repo',
    description: 'A test repository',
    owner: { id: 1, login: 'testuser', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/testuser/test-repo',
    stargazers_count: 150000,
    language: 'TypeScript',
    topics: ['test'],
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-01T00:00:00Z',
    archived: false,
    fork: false,
    forks_count: 100,
    open_issues_count: 10,
    private: false,
    disabled: false,
    full_name: 'testuser/test-repo'
  }
];

describe('Search History Integration', () => {
  let engine: UnifiedSearchEngine;

  beforeEach(async () => {
    // 清理存储
    await defaultStorage.clear();
    
    engine = new UnifiedSearchEngine();
    await engine.initialize(mockRepositories);
  });

  test('search should record history', async () => {
    const results = await engine.search({
      text: 'test',
      type: 'keyword'
    });

    expect(results.length).toBe(1);
    
    // 检查历史记录
    const history = await engine.getSearchHistory();
    expect(history.length).toBe(1);
    
    const historyItem = history[0];
    expect(historyItem.query).toBe('test');
    expect(historyItem.type).toBe('keyword');
    expect(historyItem.resultCount).toBe(1);
    expect(historyItem.executionTime).toBeGreaterThan(0);
  });

  test('empty search should not record history', async () => {
    const results = await engine.search({
      text: '',
      type: 'keyword',
      options: {
        filters: {
          language: 'TypeScript'
        }
      }
    });

    expect(results.length).toBe(1);
    
    // 空搜索不应该记录历史
    const history = await engine.getSearchHistory();
    expect(history.length).toBe(0);
  });

  test('search with filters should record history with filters', async () => {
    const results = await engine.search({
      text: 'test repo',
      type: 'keyword',
      options: {
        filters: {
          language: 'TypeScript',
          minStars: 1000
        }
      }
    });

    expect(results.length).toBe(1);
    
    const history = await engine.getSearchHistory();
    expect(history.length).toBe(1);
    expect(history[0].filters).toBeDefined();
    expect(history[0].filters?.language).toBe('TypeScript');
    expect(history[0].filters?.minStars).toBe(1000);
  });

  test('get search suggestions', async () => {
    // 先执行一些搜索
    await engine.search({ text: 'react', type: 'keyword' });
    await engine.search({ text: 'typescript', type: 'keyword' });
    await engine.search({ text: 'vue', type: 'keyword' });

    // 获取建议
    const suggestions = await engine.suggest('t');
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.text.includes('typescript'))).toBe(true);
  });

  test('clear search history', async () => {
    await engine.search({ text: 'test1', type: 'keyword' });
    await engine.search({ text: 'test2', type: 'keyword' });

    let history = await engine.getSearchHistory();
    expect(history.length).toBe(2);

    await engine.clearSearchHistory();
    
    history = await engine.getSearchHistory();
    expect(history.length).toBe(0);
  });

  test('get popular searches', async () => {
    // 多次搜索相同内容
    await engine.search({ text: 'react', type: 'keyword' });
    await engine.search({ text: 'react', type: 'keyword' });
    await engine.search({ text: 'typescript', type: 'keyword' });

    const popular = await engine.getPopularSearches();
    expect(popular.length).toBeGreaterThan(0);
    
    // react 应该比 typescript 更热门
    const reactPopularity = popular.find(p => p.text === 'react')?.frequency || 0;
    const tsPopularity = popular.find(p => p.text === 'typescript')?.frequency || 0;
    expect(reactPopularity).toBeGreaterThan(tsPopularity);
  });
});