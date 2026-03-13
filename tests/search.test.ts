import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { RepoInput } from '../src/lib/storage.js';

let tmpDir: string;

function makeRepo(overrides: Partial<RepoInput> = {}): RepoInput {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    full_name: 'user/repo',
    name: 'repo',
    description: 'A test repo',
    html_url: 'https://github.com/user/repo',
    homepage: '',
    language: 'TypeScript',
    topics: ['testing'],
    stars_count: 10,
    forks_count: 1,
    starred_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'starepo-search-test-'));
  process.env.XDG_DATA_HOME = join(tmpDir, 'data');
  process.env.XDG_CONFIG_HOME = join(tmpDir, 'config');
  vi.resetModules();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XDG_DATA_HOME;
  delete process.env.XDG_CONFIG_HOME;
  vi.restoreAllMocks();
});

describe('hybridSearch: empty DB', () => {
  it('returns empty array when no repos exist', async () => {
    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('anything');
    expect(results).toEqual([]);
  });
});

describe('hybridSearch: FTS only (no embeddings)', () => {
  beforeEach(async () => {
    const { upsertRepos } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/react-query', name: 'react-query', description: 'Async state management for React', language: 'TypeScript', topics: ['react', 'query'] }),
      makeRepo({ id: 2, full_name: 'b/vue-router', name: 'vue-router', description: 'Official router for Vue.js', language: 'TypeScript', topics: ['vue', 'router'] }),
      makeRepo({ id: 3, full_name: 'c/django-rest', name: 'django-rest', description: 'REST framework for Django', language: 'Python', topics: ['python', 'api'] }),
    ]);
  });

  it('finds repos by name keyword', async () => {
    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('react');
    expect(results.some(r => r.full_name === 'a/react-query')).toBe(true);
  });

  it('finds repos by description keyword', async () => {
    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('Django');
    expect(results.some(r => r.full_name === 'c/django-rest')).toBe(true);
  });

  it('returns empty for unmatched query', async () => {
    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('xyzzy_nonexistent_12345');
    expect(results).toHaveLength(0);
  });

  it('respects limit', async () => {
    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('TypeScript', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

describe('hybridSearch: vector + FTS when embeddings exist', () => {
  beforeEach(async () => {
    const { upsertRepos, updateEmbedding } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/ml-lib', name: 'ml-lib', description: 'Machine learning library', language: 'Python', topics: ['ml'] }),
      makeRepo({ id: 2, full_name: 'b/web-fw', name: 'web-fw', description: 'Fast web framework', language: 'Go', topics: ['web'] }),
    ]);
    // Give a/ml-lib a non-zero embedding so hybridSearch uses vector path
    await updateEmbedding('a/ml-lib', new Array(1024).fill(0.1));
  });

  it('calls generateEmbedding and returns results', async () => {
    // Mock embeddings module so tests don't download the model
    vi.doMock('../src/lib/embeddings.js', () => ({
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('machine learning');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('hybridSearch: deduplication', () => {
  it('does not return duplicate repos when both vector and FTS match', async () => {
    const { upsertRepos, updateEmbedding } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/react-lib', name: 'react-lib', description: 'React library', language: 'TypeScript', topics: ['react'] }),
    ]);
    await updateEmbedding('a/react-lib', new Array(1024).fill(0.1));

    vi.doMock('../src/lib/embeddings.js', () => ({
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('react');

    const names = results.map(r => r.full_name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe('hybridSearch: candidate expansion for correctness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function makeStoredRepo(i: number, overrides: Record<string, unknown> = {}) {
    return {
      id: i,
      full_name: `user/repo-${i}`,
      name: `repo-${i}`,
      description: 'tooling utility',
      html_url: `https://github.com/user/repo-${i}`,
      homepage: '',
      language: 'TypeScript',
      topics: '["tooling"]',
      stars_count: i,
      forks_count: i,
      starred_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      vector: new Array(1024).fill(0),
      ...overrides,
    };
  }

  it('expands FTS candidates when structured filters are present', async () => {
    const count = 120;
    const allResults = Array.from({ length: count }, (_, i) =>
      makeStoredRepo(i, { language: i === 75 || i === 90 ? 'Rust' : 'TypeScript' })
    );
    const searchFTS = vi.fn().mockImplementation(async (_query: string, limit: number) =>
      allResults.slice(0, limit)
    );

    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      searchVector: vi.fn(),
      searchFTS,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(count),
      }),
      hasAnyEmbeddings: vi.fn().mockResolvedValue(false),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('tooling', 2, { language: 'Rust' });

    expect(searchFTS.mock.calls).toEqual([
      ['tooling', 50],
      ['tooling', 100],
    ]);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.full_name)).toEqual(['user/repo-75', 'user/repo-90']);
  });

  it('expands candidates for non-relevance sorting in query mode', async () => {
    const count = 120;
    const searchFTS = vi.fn().mockResolvedValue(
      Array.from({ length: count }, (_, i) =>
        makeStoredRepo(i, {
          full_name: `user/sort-${i}`,
          name: `sort-${i}`,
          stars_count: i,
          forks_count: count - i,
        })
      )
    );

    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      searchVector: vi.fn(),
      searchFTS,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(count),
      }),
      hasAnyEmbeddings: vi.fn().mockResolvedValue(false),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('tooling', 3, { sort: 'stars', order: 'desc' });

    expect(searchFTS).toHaveBeenCalledWith('tooling', count);
    expect(results.map(r => r.full_name)).toEqual([
      'user/sort-119',
      'user/sort-118',
      'user/sort-117',
    ]);
  });

  it('does not pre-limit list mode before business sorting', async () => {
    const listRepos = vi.fn().mockResolvedValue([
      makeStoredRepo(1, { full_name: 'user/low', name: 'low', stars_count: 1 }),
      makeStoredRepo(2, { full_name: 'user/high', name: 'high', stars_count: 100 }),
      makeStoredRepo(3, { full_name: 'user/mid', name: 'mid', stars_count: 50 }),
    ]);

    vi.doMock('../src/lib/storage.js', () => ({
      listRepos,
      searchVector: vi.fn(),
      searchFTS: vi.fn(),
      getTable: vi.fn(),
      hasAnyEmbeddings: vi.fn(),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    const results = await hybridSearch('', 2, { sort: 'stars', order: 'desc' });

    expect(listRepos).toHaveBeenCalledWith({
      language: undefined,
      topic: undefined,
      starredAfter: undefined,
      starredBefore: undefined,
      limit: undefined,
    });
    expect(results.map(r => r.full_name)).toEqual(['user/high', 'user/mid']);
  });
});

describe('hybridSearch: embedding availability lookup', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses cached embedding availability instead of scanning repos on every search', async () => {
    const count = 10;
    const hasAnyEmbeddings = vi.fn().mockResolvedValue(false);
    const searchFTS = vi.fn().mockResolvedValue([
      {
        id: 1,
        full_name: 'user/repo',
        name: 'repo',
        description: 'tooling utility',
        html_url: 'https://github.com/user/repo',
        homepage: '',
        language: 'TypeScript',
        topics: '["tooling"]',
        stars_count: 1,
        forks_count: 1,
        starred_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        vector: new Array(1024).fill(0),
      },
    ]);

    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      searchVector: vi.fn(),
      searchFTS,
      hasAnyEmbeddings,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(count),
      }),
    }));

    const { hybridSearch } = await import('../src/lib/search.js');
    await hybridSearch('tooling', 1);
    await hybridSearch('tooling', 1);

    expect(hasAnyEmbeddings).toHaveBeenCalledTimes(2);
    expect(hasAnyEmbeddings).toHaveBeenCalledWith(count);
  });
});
