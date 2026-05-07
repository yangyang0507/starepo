import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repo } from '../src/lib/storage.js';

const repo: Repo = {
  id: 1,
  full_name: 'user/repo',
  name: 'repo',
  description: 'A useful repo',
  html_url: 'https://github.com/user/repo',
  homepage: '',
  language: 'TypeScript',
  topics: '["cli","typescript"]',
  topics_text: 'cli typescript',
  stars_count: 10,
  forks_count: 2,
  starred_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('runSearch', () => {
  it('runs a query search and prints JSON without vectors', async () => {
    const logs: string[] = [];
    const hybridSearch = vi.fn().mockResolvedValue([{ ...repo, vector: [0.1] }]);
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch,
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch('cli', { limit: 3, json: true });

    expect(hybridSearch).toHaveBeenCalledWith('cli', 3, {
      language: undefined,
      topic: undefined,
      starredAfter: undefined,
      starredBefore: undefined,
      sort: undefined,
      order: undefined,
    });
    const jsonLine = logs.find((line) => line.startsWith('['));
    expect(JSON.parse(jsonLine!)[0]).toMatchObject({ full_name: 'user/repo' });
    expect(JSON.parse(jsonLine!)[0]).not.toHaveProperty('vector');
  });

  it('allows structured-filter-only searches', async () => {
    const hybridSearch = vi.fn().mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch,
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch(undefined, { language: 'TypeScript', limit: 2 });

    expect(hybridSearch).toHaveBeenCalledWith('', 2, expect.objectContaining({
      language: 'TypeScript',
    }));
  });

  it('prints formatted text results by default', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn().mockResolvedValue([repo]),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch('cli');

    expect(logs.join('\n')).toContain('Found 1 result(s)');
    expect(logs.join('\n')).toContain('1. user/repo [TypeScript]');
    expect(logs.join('\n')).toContain('Topics: cli, typescript');
  });

  it('exits when no query or structured filters are provided', async () => {
    const errors: string[] = [];
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as typeof process.exit);
    vi.spyOn(console, 'error').mockImplementation((message?: string) => {
      errors.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await expect(runSearch(undefined)).rejects.toThrow('process.exit');

    expect(exit).toHaveBeenCalledWith(1);
    expect(errors.join('\n')).toContain('Please provide a query');
  });
});

describe('runList', () => {
  it('lists repos from storage when no query is provided', async () => {
    const logs: string[] = [];
    const listRepos = vi.fn().mockResolvedValue([
      { ...repo, full_name: 'user/low', stars_count: 1 },
      { ...repo, full_name: 'user/high', stars_count: 100 },
    ]);
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos,
      getStats: vi.fn().mockResolvedValue({ count: 2, lastSync: null }),
      getRepoByName: vi.fn(),
    }));
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runList } = await import('../src/commands/list.js');
    await runList({ limit: 1, sort: 'stars', order: 'desc' });

    expect(listRepos).toHaveBeenCalledWith({
      language: undefined,
      topic: undefined,
      starredAfter: undefined,
      starredBefore: undefined,
      limit: undefined,
    });
    expect(logs.join('\n')).toContain('user/high');
    expect(logs.join('\n')).not.toContain('user/low');
  });

  it('uses hybrid search when a query is provided', async () => {
    const hybridSearch = vi.fn().mockResolvedValue([repo]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      getStats: vi.fn().mockResolvedValue({ count: 1, lastSync: null }),
      getRepoByName: vi.fn(),
    }));
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch,
    }));

    const { runList } = await import('../src/commands/list.js');
    await runList({ query: 'cli', limit: 4, language: 'TypeScript' });

    expect(hybridSearch).toHaveBeenCalledWith('cli', 4, expect.objectContaining({
      language: 'TypeScript',
    }));
  });

  it('prints repository info when found', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      getStats: vi.fn(),
      getRepoByName: vi.fn().mockResolvedValue(repo),
    }));
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runInfo } = await import('../src/commands/list.js');
    await runInfo('user/repo');

    expect(logs.join('\n')).toContain('Name:        user/repo');
    expect(logs.join('\n')).toContain('Topics:      cli, typescript');
  });
});
