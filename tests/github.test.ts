import { afterEach, describe, expect, it, vi } from 'vitest';
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

function mockOctokit(pages: unknown[][], links: string[] = []): Octokit {
  return {
    activity: {
      listReposStarredByAuthenticatedUser: () => undefined,
    },
    paginate: {
      iterator: async function* () {
        for (const [i, page] of pages.entries()) {
          yield { data: page, headers: { link: links[i] } };
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

  it('reports an estimated total from the last-page link, made exact on the last page', async () => {
    const { fetchAllStars } = await import('../src/lib/github.js');
    const base = 'https://api.github.com/user/starred?per_page=100';
    const pages = [[starredItem()], [starredItem()], [starredItem()]];
    const links = [
      `<${base}&page=2>; rel="next", <${base}&page=3>; rel="last"`,
      `<${base}&page=1>; rel="prev", <${base}&page=3>; rel="next", <${base}&page=3>; rel="last"`,
      `<${base}&page=2>; rel="prev", <${base}&page=1>; rel="first"`,
    ];
    const calls: Array<[number, number | undefined]> = [];

    await fetchAllStars(mockOctokit(pages, links), (count, total) => calls.push([count, total]));

    expect(calls).toEqual([[1, 300], [2, 300], [3, 3]]);
  });
});

describe('presentVerification', () => {
  const verification = { verification_uri: 'https://github.com/login/device', user_code: 'ABCD-1234', expires_in: 900 };
  let output: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    output = [];
  });

  function captureStderr() {
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });
  }

  it('copies the code and opens the page after Enter when someone is at the terminal', async () => {
    captureStderr();
    const calls: string[] = [];
    const { presentVerification } = await import('../src/lib/github.js');

    await presentVerification(verification, {
      interactive: true,
      copy: async (text) => (calls.push(`copy ${text}`), true),
      waitForEnter: async () => {
        calls.push('enter');
      },
      open: async (url) => (calls.push(`open ${url}`), true),
    });

    expect(calls).toEqual(['copy ABCD-1234', 'enter', 'open https://github.com/login/device']);
    expect(output.join('')).toContain('One-time code: ABCD-1234 (copied to clipboard)');
    expect(output.join('')).toContain('Press Enter to open https://github.com/login/device');
  });

  it('prints the URL to visit when no browser can be launched', async () => {
    captureStderr();
    const { presentVerification } = await import('../src/lib/github.js');

    await presentVerification(verification, {
      interactive: true,
      copy: async () => false,
      waitForEnter: async () => {},
      open: async () => false,
    });

    expect(output.join('')).not.toContain('copied');
    expect(output.join('')).toContain('open https://github.com/login/device manually');
  });

  it('just prints instructions without prompting when nobody is at a terminal', async () => {
    captureStderr();
    const copy = vi.fn();
    const waitForEnter = vi.fn();
    const { presentVerification } = await import('../src/lib/github.js');

    await presentVerification(verification, { interactive: false, copy, waitForEnter, open: vi.fn() });

    expect(copy).not.toHaveBeenCalled();
    expect(waitForEnter).not.toHaveBeenCalled();
    expect(output.join('')).toContain('Open https://github.com/login/device and enter the code (expires in 15 minutes).');
  });
});
