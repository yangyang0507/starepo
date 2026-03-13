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

  it('preserves existing embeddings when upserting metadata without vector', async () => {
    const { upsertRepos, updateEmbedding, getRepoByName } = await import('../src/lib/storage.js');
    const repo = makeRepo({ full_name: 'alice/hello', stars_count: 10 });
    await upsertRepos([repo]);
    await updateEmbedding('alice/hello', new Array(1024).fill(0.1));

    await upsertRepos([{ ...repo, stars_count: 999 }]);

    const found = await getRepoByName('alice/hello');
    const vector = Array.isArray(found!.vector)
      ? found!.vector
      : Array.from(found!.vector as unknown as ArrayLike<number>);

    expect(found!.stars_count).toBe(999);
    expect(vector[0]).toBeCloseTo(0.1);
    expect(vector.every(v => v === 0)).toBe(false);
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

describe('storage: hasAnyEmbeddings', () => {
  it('returns false and persists metadata when no embeddings exist', async () => {
    const { upsertRepos, hasAnyEmbeddings } = await import('../src/lib/storage.js');
    const { getMeta } = await import('../src/lib/config.js');

    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
      makeRepo({ id: 2, full_name: 'x/b' }),
    ]);

    expect(await hasAnyEmbeddings()).toBe(false);
    expect(getMeta('has_embeddings')).toBe('false');
  });

  it('returns true after an embedding is stored and persists metadata', async () => {
    const { upsertRepos, updateEmbedding, hasAnyEmbeddings } = await import('../src/lib/storage.js');
    const { getMeta } = await import('../src/lib/config.js');

    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
    ]);
    await updateEmbedding('x/a', new Array(1024).fill(0.1));

    expect(await hasAnyEmbeddings()).toBe(true);
    expect(getMeta('has_embeddings')).toBe('true');
  });
});

describe('storage: deleteReposMissingFromFullNames', () => {
  it('deletes stale repos and returns the number removed', async () => {
    const { upsertRepos, deleteReposMissingFromFullNames, getRepoByName, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/keep' }),
      makeRepo({ id: 2, full_name: 'b/stale' }),
      makeRepo({ id: 3, full_name: 'c/stale' }),
    ]);

    const removed = await deleteReposMissingFromFullNames(['a/keep']);

    expect(removed).toBe(2);
    expect(await getRepoByName('a/keep')).not.toBeNull();
    expect(await getRepoByName('b/stale')).toBeNull();
    expect(await getRepoByName('c/stale')).toBeNull();
    expect((await getStats()).count).toBe(1);
  });

  it('deletes all repos when the keep set is empty', async () => {
    const { upsertRepos, deleteReposMissingFromFullNames, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/keep' }),
      makeRepo({ id: 2, full_name: 'b/stale' }),
    ]);

    const removed = await deleteReposMissingFromFullNames([]);

    expect(removed).toBe(2);
    expect((await getStats()).count).toBe(0);
  });

  it('returns zero when all repos are retained', async () => {
    const { upsertRepos, deleteReposMissingFromFullNames, getStats } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/keep' }),
      makeRepo({ id: 2, full_name: 'b/keep' }),
    ]);

    const removed = await deleteReposMissingFromFullNames(['a/keep', 'b/keep']);

    expect(removed).toBe(0);
    expect((await getStats()).count).toBe(2);
  });

  it('resets embedding availability when deletion empties the table', async () => {
    const { upsertRepos, updateEmbedding, deleteReposMissingFromFullNames, hasAnyEmbeddings } = await import('../src/lib/storage.js');
    const { getMeta } = await import('../src/lib/config.js');

    await upsertRepos([
      makeRepo({ id: 1, full_name: 'a/keep' }),
    ]);
    await updateEmbedding('a/keep', new Array(1024).fill(0.1));
    expect(await hasAnyEmbeddings()).toBe(true);

    const removed = await deleteReposMissingFromFullNames([]);

    expect(removed).toBe(1);
    expect(await hasAnyEmbeddings()).toBe(false);
    expect(getMeta('has_embeddings')).toBe('false');
  });
});

describe('storage: FTS index initialization', () => {
  it('creates the FTS index once during table setup, not on every search', async () => {
    vi.resetModules();

    vi.doMock('apache-arrow', () => ({
      Schema: class Schema {},
      Field: class Field {},
      Utf8: class Utf8 {},
      Int32: class Int32 {},
      Float32: class Float32 {},
      FixedSizeList: class FixedSizeList {},
    }));

    const createIndex = vi.fn().mockResolvedValue(undefined);
    const searchToArray = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ toArray: searchToArray });
    const search = vi.fn().mockReturnValue({ limit });
    const table = {
      createIndex,
      search,
      query: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      countRows: vi.fn().mockResolvedValue(0),
    };

    vi.doMock('@lancedb/lancedb', () => ({
      connect: vi.fn().mockResolvedValue({
        tableNames: vi.fn().mockResolvedValue(['repos']),
        openTable: vi.fn().mockResolvedValue(table),
      }),
    }));

    const { searchFTS } = await import('../src/lib/storage.js');

    await searchFTS('react', 10);
    await searchFTS('vue', 10);

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(2);
  });
});
