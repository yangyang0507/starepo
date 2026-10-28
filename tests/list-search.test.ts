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

  it('prints an empty JSON array for --json when there are no results', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn().mockResolvedValue([]),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch('cli', { json: true });

    expect(logs).toEqual(['[]']);
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
    const banners: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      banners.push(String(chunk));
      return true;
    });
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn().mockResolvedValue([repo]),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch('cli');

    expect(banners.join('')).toContain('Found 1 result(s)');
    expect(logs.join('\n')).toContain('1. user/repo [TypeScript]');
    expect(logs.join('\n')).toContain('Topics: cli, typescript');
  });

  it('prints one result per line with --oneline', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn().mockResolvedValue([repo]),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await runSearch('cli', { oneline: true });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('1. user/repo [TypeScript]');
    expect(logs[0]).not.toContain('\n');
  });

  it('rejects when no query or structured filters are provided', async () => {
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runSearch } = await import('../src/commands/search.js');
    await expect(runSearch(undefined)).rejects.toThrow('Please provide a query');
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

  it('accepts GitHub URLs and resolves case-insensitive names', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    const getRepoByName = vi.fn().mockResolvedValue(null);
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn().mockResolvedValue([repo]),
      getStats: vi.fn(),
      getRepoByName,
    }));
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runInfo } = await import('../src/commands/list.js');
    await runInfo('https://github.com/User/Repo.git');

    expect(getRepoByName).toHaveBeenCalledWith('User/Repo');
    expect(logs.join('\n')).toContain('Name:        user/repo');
  });

  it('suggests similarly named repos when the repo is not found', async () => {
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn().mockResolvedValue([
        { ...repo, full_name: 'other/repo', stars_count: 5 },
        { ...repo, full_name: 'user/repo', stars_count: 50 },
        { ...repo, full_name: 'user/unrelated', name: 'unrelated' },
      ]),
      getStats: vi.fn(),
      getRepoByName: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));

    const { runInfo } = await import('../src/commands/list.js');
    await expect(runInfo('someone/repo')).rejects.toThrow(
      'Repository "someone/repo" not found in your stars.\nDid you mean:\n  user/repo\n  other/repo',
    );
  });
});
