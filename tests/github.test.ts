import { describe, expect, it } from 'vitest';
import type { Octokit } from '@octokit/rest';

function starredItem(overrides: Record<string, unknown> = {}) {
  return {
    starred_at: '2026-01-02T00:00:00Z',
    repo: {
      id: 1,
      full_name: 'user/repo',
      name: 'repo',
      description: null,
      html_url: 'https://github.com/user/repo',
      homepage: null,
      language: null,
      topics: ['cli'],
      stargazers_count: 10,
      forks_count: 2,
      updated_at: null,
    },
    ...overrides,
  };
}

function mockOctokit(pages: unknown[][]): Octokit {
  return {
    activity: {
      listReposStarredByAuthenticatedUser: () => undefined,
    },
    paginate: {
      iterator: async function* () {
        for (const page of pages) {
          yield { data: page };
        }
      },
    },
  } as unknown as Octokit;
}

describe('github star fetching', () => {
  it('maps starred API items into RepoInput records', async () => {
    const { fetchAllStars } = await import('../src/lib/github.js');
    const repos = await fetchAllStars(mockOctokit([
      [starredItem()],
    ]));

    expect(repos).toEqual([
      {
        id: 1,
        full_name: 'user/repo',
        name: 'repo',
        description: '',
        html_url: 'https://github.com/user/repo',
        homepage: '',
        language: '',
        topics: ['cli'],
        stars_count: 10,
        forks_count: 2,
        starred_at: '2026-01-02T00:00:00Z',
        updated_at: '',
      },
    ]);
  });

  it('stops incremental fetching when it reaches stars older than since', async () => {
    const { fetchStarsSince } = await import('../src/lib/github.js');
    const repos = await fetchStarsSince(mockOctokit([
      [
        starredItem({ starred_at: '2026-01-03T00:00:00Z' }),
        starredItem({
          starred_at: '2026-01-01T00:00:00Z',
          repo: { ...starredItem().repo, full_name: 'user/old', name: 'old' },
        }),
      ],
      [starredItem({ repo: { ...starredItem().repo, full_name: 'user/never', name: 'never' } })],
    ]), new Date('2026-01-02T00:00:00Z'));

    expect(repos.map(repo => repo.full_name)).toEqual(['user/repo']);
  });

  it('throws a clear error for non-starred GitHub response shapes', async () => {
    const { fetchAllStars } = await import('../src/lib/github.js');

    await expect(fetchAllStars(mockOctokit([
      [{ id: 1, full_name: 'user/repo' }],
    ]))).rejects.toThrow('Unexpected GitHub starred repository response');
  });
});
