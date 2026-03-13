import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  tmpDir = mkdtempSync(join(tmpdir(), 'starepo-sync-test-'));
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

describe('runSync: full sync cleanup', () => {
  it('removes locally cached repos that are no longer starred', async () => {
    const { upsertRepos, getRepoByName, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'keep/repo', name: 'repo' }),
      makeRepo({ id: 2, full_name: 'stale/repo', name: 'repo' }),
    ]);

    vi.doMock('../src/commands/auth.js', () => ({
      ensureAuth: vi.fn().mockResolvedValue('token'),
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn().mockReturnValue({}),
      fetchAllStars: vi.fn().mockResolvedValue([
        makeRepo({ id: 1, full_name: 'keep/repo', name: 'repo' }),
      ]),
      fetchStarsSince: vi.fn(),
    }));
    vi.doMock('../src/lib/embeddings.js', () => ({
      generateAndStoreEmbeddings: vi.fn(),
    }));

    const { runSync } = await import('../src/commands/sync.js');
    await runSync({ noEmbeddings: true });

    expect(await getRepoByName('keep/repo')).not.toBeNull();
    expect(await getRepoByName('stale/repo')).toBeNull();
    expect((await getStats()).count).toBe(1);
  });

  it('clears the local cache when full sync returns zero stars', async () => {
    const { upsertRepos, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'stale/repo', name: 'repo' }),
    ]);

    vi.doMock('../src/commands/auth.js', () => ({
      ensureAuth: vi.fn().mockResolvedValue('token'),
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn().mockReturnValue({}),
      fetchAllStars: vi.fn().mockResolvedValue([]),
      fetchStarsSince: vi.fn(),
    }));
    vi.doMock('../src/lib/embeddings.js', () => ({
      generateAndStoreEmbeddings: vi.fn(),
    }));

    const { runSync } = await import('../src/commands/sync.js');
    await runSync({ noEmbeddings: true });

    expect((await getStats()).count).toBe(0);
  });

  it('preserves existing embeddings when sync runs with noEmbeddings', async () => {
    const { upsertRepos, updateEmbedding, getRepoByName } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'keep/repo', name: 'repo', stars_count: 10 }),
    ]);
    await updateEmbedding('keep/repo', new Array(1024).fill(0.1));

    vi.doMock('../src/commands/auth.js', () => ({
      ensureAuth: vi.fn().mockResolvedValue('token'),
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn().mockReturnValue({}),
      fetchAllStars: vi.fn().mockResolvedValue([
        makeRepo({ id: 1, full_name: 'keep/repo', name: 'repo', stars_count: 20 }),
      ]),
      fetchStarsSince: vi.fn(),
    }));
    vi.doMock('../src/lib/embeddings.js', () => ({
      generateAndStoreEmbeddings: vi.fn(),
    }));

    const { runSync } = await import('../src/commands/sync.js');
    await runSync({ noEmbeddings: true });

    const found = await getRepoByName('keep/repo');
    const vector = Array.isArray(found!.vector)
      ? found!.vector
      : Array.from(found!.vector as unknown as ArrayLike<number>);

    expect(found!.stars_count).toBe(20);
    expect(vector[0]).toBeCloseTo(0.1);
    expect(vector.every(v => v === 0)).toBe(false);
  });
});
