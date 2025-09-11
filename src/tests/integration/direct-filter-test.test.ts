import { describe, test, expect, beforeEach } from 'vitest';
import { UnifiedSearchEngine } from '@/services/search';
import type { GitHubRepository } from '@/services/github/types';

// 最小测试数据
const simpleMockRepos: GitHubRepository[] = [
  {
    id: 1,
    name: 'test-repo',
    description: 'test repository',
    owner: { id: 1, login: 'testuser', avatar_url: '', html_url: '' },
    html_url: 'https://github.com/testuser/test-repo',
    stargazers_count: 150000,
    language: 'TypeScript',
    topics: [],
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

describe('Direct Filter Integration Test', () => {
  let engine: UnifiedSearchEngine;

  beforeEach(async () => {
    engine = new UnifiedSearchEngine();
    await engine.initialize(simpleMockRepos);
  });

  test('direct star filter test', async () => {
    // 直接测试星标筛选
    const results = await engine.search({
      text: '',
      type: 'keyword',
      options: {
        filters: {
          minStars: 100000 // 使用基础筛选器先测试
        }
      }
    });

    expect(results.length).toBe(1);
    expect(results[0].repository.name).toBe('test-repo');
  });

  test('direct advanced filter test', async () => {
    // 直接测试高级筛选器
    const results = await engine.search({
      text: '',
      type: 'keyword',
      options: {
        filters: {
          advancedFilters: [{
            id: 'test-group',
            name: 'Test',
            logic: 'AND',
            enabled: true,
            rules: [{
              id: 'test-rule',
              field: 'stars',
              operator: 'greaterThan',
              value: 100000,
              enabled: true
            }]
          }]
        }
      }
    });

    expect(results.length).toBe(1);
    expect(results[0].repository.name).toBe('test-repo');
  });
});