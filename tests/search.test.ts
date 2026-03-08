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
