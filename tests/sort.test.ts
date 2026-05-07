import { describe, expect, it } from 'vitest';
import { parseListOptions, parsePositiveIntOption, sortRepos } from '../src/lib/sort.js';
import type { Repo } from '../src/lib/storage.js';

function repo(fullName: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id: 1,
    full_name: fullName,
    name: fullName.split('/')[1],
    description: '',
    html_url: `https://github.com/${fullName}`,
    homepage: '',
    language: '',
    topics: '[]',
    stars_count: 0,
    forks_count: 0,
    starred_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('parsePositiveIntOption', () => {
  it('accepts positive integer strings and numbers', () => {
    expect(parsePositiveIntOption('10', '--limit')).toBe(10);
    expect(parsePositiveIntOption(25, 'limit')).toBe(25);
  });

  it('rejects malformed, fractional, zero, negative, and excessive values', () => {
    for (const value of ['abc', '10abc', '1.5', 0, -1, 1.5, 501]) {
      expect(() => parsePositiveIntOption(value, '--limit')).toThrow('Invalid --limit value');
    }
  });
});

describe('parseListOptions', () => {
  it('normalizes CLI list options', () => {
    expect(parseListOptions({
      lang: 'TypeScript',
      topic: 'cli',
      since: '2026-01-01',
      limit: '20',
      sort: 'stars',
      order: 'asc',
      json: true,
    })).toMatchObject({
      language: 'TypeScript',
      topic: 'cli',
      limit: 20,
      sort: 'stars',
      order: 'asc',
      json: true,
    });
  });

  it('rejects invalid sort and order options', () => {
    expect(() => parseListOptions({ limit: '10', sort: 'name' })).toThrow('Invalid --sort value');
    expect(() => parseListOptions({ limit: '10', order: 'sideways' })).toThrow('Invalid --order value');
  });
});

describe('sortRepos', () => {
  const repos = [
    repo('user/low', { stars_count: 1, forks_count: 30, starred_at_ts: 100, updated_at_ts: 300 }),
    repo('user/high', { stars_count: 100, forks_count: 10, starred_at_ts: 300, updated_at_ts: 100 }),
    repo('user/mid', { stars_count: 50, forks_count: 20, starred_at_ts: 200, updated_at_ts: 200 }),
  ];

  it('sorts by numeric and timestamp fields', () => {
    expect(sortRepos(repos, 'stars', 'desc').map(r => r.full_name)).toEqual(['user/high', 'user/mid', 'user/low']);
    expect(sortRepos(repos, 'forks', 'asc').map(r => r.full_name)).toEqual(['user/high', 'user/mid', 'user/low']);
    expect(sortRepos(repos, 'starred', 'asc').map(r => r.full_name)).toEqual(['user/low', 'user/mid', 'user/high']);
    expect(sortRepos(repos, 'updated', 'desc').map(r => r.full_name)).toEqual(['user/low', 'user/mid', 'user/high']);
  });

  it('preserves order for relevance sorting', () => {
    expect(sortRepos(repos, 'relevance', 'desc')).toBe(repos);
  });
});
