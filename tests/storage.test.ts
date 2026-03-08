import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    topics: ['testing', 'vitest'],
    stars_count: 100,
    forks_count: 10,
    starred_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'starepo-storage-test-'));
  process.env.XDG_DATA_HOME = join(tmpDir, 'data');
  process.env.XDG_CONFIG_HOME = join(tmpDir, 'config');
  vi.resetModules();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XDG_DATA_HOME;
  delete process.env.XDG_CONFIG_HOME;
});

describe('storage: upsertRepos / getRepoByName', () => {
  it('inserts a repo and retrieves it by full_name', async () => {
    const { upsertRepos, getRepoByName } = await import('../src/lib/storage.js');
    const repo = makeRepo({ full_name: 'alice/hello', name: 'hello' });
    await upsertRepos([repo]);

    const found = await getRepoByName('alice/hello');
    expect(found).not.toBeNull();
    expect(found!.full_name).toBe('alice/hello');
    expect(found!.name).toBe('hello');
  });

  it('returns null for non-existent repo', async () => {
    const { getRepoByName } = await import('../src/lib/storage.js');
    const found = await getRepoByName('nobody/nothing');
    expect(found).toBeNull();
  });

  it('upserts (updates) an existing repo', async () => {
    const { upsertRepos, getRepoByName } = await import('../src/lib/storage.js');
    const repo = makeRepo({ full_name: 'alice/hello', stars_count: 10 });
    await upsertRepos([repo]);
    await upsertRepos([{ ...repo, stars_count: 999 }]);

    const found = await getRepoByName('alice/hello');
    expect(found!.stars_count).toBe(999);
  });

  it('inserts multiple repos in one call', async () => {
    const { upsertRepos, getStats } = await import('../src/lib/storage.js');
    const repos = [
      makeRepo({ id: 1, full_name: 'a/r1' }),
      makeRepo({ id: 2, full_name: 'b/r2' }),
      makeRepo({ id: 3, full_name: 'c/r3' }),
    ];
    await upsertRepos(repos);

    const { count } = await getStats();
    expect(count).toBe(3);
  });

  it('serializes topics as JSON string', async () => {
    const { upsertRepos, getRepoByName } = await import('../src/lib/storage.js');
    const repo = makeRepo({ full_name: 'x/y', topics: ['ai', 'ml'] });
    await upsertRepos([repo]);

    const found = await getRepoByName('x/y');
    const topics = JSON.parse(found!.topics);
    expect(topics).toEqual(['ai', 'ml']);
  });
});

describe('storage: listRepos', () => {
  beforeEach(async () => {
    const { upsertRepos } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/ts-lib', language: 'TypeScript', topics: ['frontend'], starred_at: '2026-01-01T00:00:00Z' }),
      makeRepo({ id: 2, full_name: 'b/py-tool', language: 'Python', topics: ['cli'], starred_at: '2026-01-02T00:00:00Z' }),
      makeRepo({ id: 3, full_name: 'c/go-svc', language: 'Go', topics: ['backend', 'api'], starred_at: '2026-01-03T00:00:00Z' }),
    ]);
  });

  it('lists all repos without filters', async () => {
    const { listRepos } = await import('../src/lib/storage.js');
    const repos = await listRepos({ limit: 10 });
    expect(repos.length).toBe(3);
  });

  it('filters by language (case-insensitive)', async () => {
    const { listRepos } = await import('../src/lib/storage.js');
    const repos = await listRepos({ language: 'python' });
    expect(repos.length).toBe(1);
    expect(repos[0].full_name).toBe('b/py-tool');
  });

  it('filters by topic', async () => {
    const { listRepos } = await import('../src/lib/storage.js');
    const repos = await listRepos({ topic: 'backend' });
    expect(repos.length).toBe(1);
    expect(repos[0].full_name).toBe('c/go-svc');
  });

  it('respects limit', async () => {
    const { listRepos } = await import('../src/lib/storage.js');
    const repos = await listRepos({ limit: 2 });
    expect(repos.length).toBe(2);
  });

  it('filters by starred_at range', async () => {
    const { listRepos } = await import('../src/lib/storage.js');
    const repos = await listRepos({
      starredAfter: '2026-01-02T00:00:00.000Z',
      starredBefore: '2026-01-03T00:00:00.000Z',
    });
    expect(repos.length).toBe(2);
  });
});

describe('storage: getStats', () => {
  it('returns count=0 on empty DB', async () => {
    const { getStats } = await import('../src/lib/storage.js');
    const { count } = await getStats();
    expect(count).toBe(0);
  });

  it('returns correct count after insert', async () => {
    const { upsertRepos, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([makeRepo({ id: 1, full_name: 'x/a' }), makeRepo({ id: 2, full_name: 'x/b' })]);
    const { count } = await getStats();
    expect(count).toBe(2);
  });
});

describe('storage: getReposWithoutEmbedding', () => {
  it('returns all repos when none have embeddings', async () => {
    const { upsertRepos, getReposWithoutEmbedding } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
      makeRepo({ id: 2, full_name: 'x/b' }),
    ]);
    const repos = await getReposWithoutEmbedding();
    expect(repos.length).toBe(2);
  });

  it('excludes repos after embedding is stored', async () => {
    const { upsertRepos, updateEmbedding, getReposWithoutEmbedding } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
      makeRepo({ id: 2, full_name: 'x/b' }),
    ]);
    // Give x/a a real embedding
    await updateEmbedding('x/a', new Array(1024).fill(0.1));

    const repos = await getReposWithoutEmbedding();
    expect(repos.length).toBe(1);
    expect(repos[0].full_name).toBe('x/b');
  });
});
