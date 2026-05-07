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
    expect(found!.has_embedding).toBe(true);
    expect(vector[0]).toBeCloseTo(0.1);
    expect(vector.every(v => v === 0)).toBe(false);
  });

  it('rejects vectors with the wrong embedding dimension during upsert', async () => {
    const { upsertRepos } = await import('../src/lib/storage.js');

    await expect(upsertRepos([
      makeRepo({ full_name: 'alice/bad-vector', vector: [0.1, 0.2] }),
    ])).rejects.toThrow('must contain 1024 dimensions');
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

  it('stores normalized topic search fields', async () => {
    const { upsertRepos, getRepoByName } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ full_name: 'x/topics', topics: ['AI', 'Vector-Search', '  MCP  '] }),
    ]);

    const found = await getRepoByName('x/topics');
    expect(found!.topics_text).toBe('ai vector-search mcp');
    expect(found!.topics_key).toBe('|YWk|dmVjdG9yLXNlYXJjaA|bWNw|');
  });

  it('stores numeric timestamp columns for time-based filtering and sorting', async () => {
    const { upsertRepos, getRepoByName } = await import('../src/lib/storage.js');
    const repo = makeRepo({
      full_name: 'x/time',
      starred_at: '2026-01-02T03:04:05Z',
      updated_at: '2026-01-03T04:05:06Z',
    });
    await upsertRepos([repo]);

    const found = await getRepoByName('x/time');
    expect(found!.starred_at_ts).toBe(Date.parse('2026-01-02T03:04:05Z'));
    expect(found!.updated_at_ts).toBe(Date.parse('2026-01-03T04:05:06Z'));
    expect(found!.has_embedding).toBe(false);
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

  it('filters topics by exact token instead of substring', async () => {
    const { upsertRepos, listRepos } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 4, full_name: 'd/ai-tool', topics: ['ai'] }),
      makeRepo({ id: 5, full_name: 'e/tailwind-tool', topics: ['tailwind'] }),
    ]);

    const repos = await listRepos({ topic: 'AI' });

    expect(repos.map(repo => repo.full_name)).toContain('d/ai-tool');
    expect(repos.map(repo => repo.full_name)).not.toContain('e/tailwind-tool');
  });

  it('filters topics with spaces and special characters exactly', async () => {
    const { upsertRepos, listRepos } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 6, full_name: 'f/ml-notes', topics: ['machine learning'] }),
      makeRepo({ id: 7, full_name: 'g/cpp-tool', topics: ['c++'] }),
      makeRepo({ id: 8, full_name: 'h/machine-only', topics: ['machine'] }),
    ]);

    const machineLearning = await listRepos({ topic: 'Machine Learning' });
    const cpp = await listRepos({ topic: 'C++' });

    expect(machineLearning.map(repo => repo.full_name)).toEqual(['f/ml-notes']);
    expect(cpp.map(repo => repo.full_name)).toEqual(['g/cpp-tool']);
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

  it('rejects single embedding updates with the wrong dimension', async () => {
    const { upsertRepos, updateEmbedding } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
    ]);

    await expect(updateEmbedding('x/a', [0.1])).rejects.toThrow('must contain 1024 dimensions');
  });

  it('rejects batch embedding updates with the wrong dimension', async () => {
    const { upsertRepos, updateEmbeddingsBatch } = await import('../src/lib/storage.js');
    await upsertRepos([
      makeRepo({ id: 1, full_name: 'x/a' }),
    ]);

    await expect(updateEmbeddingsBatch([
      { fullName: 'x/a', vector: [0.1] },
    ])).rejects.toThrow('must contain 1024 dimensions');
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

describe('storage: schema migrations', () => {
  it('persists the current schema version after initialization', async () => {
    const { getTable } = await import('../src/lib/storage.js');
    const { getMeta } = await import('../src/lib/config.js');

    await getTable();

    expect(getMeta('schema_version')).toBe('5');
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
      Int64: class Int64 {},
      Float32: class Float32 {},
      FixedSizeList: class FixedSizeList {},
      Bool: class Bool {},
    }));

    vi.doMock('../src/lib/config.js', () => ({
      getDBPath: () => ':memory:',
      getConfigDir: () => tmpDir,
      getDataDir: () => tmpDir,
      getMeta: (key: string) => key === 'schema_version' ? '5' : null,
      setMeta: () => {},
      getToken: () => null,
      saveToken: () => {},
      clearToken: () => {},
      getAuthFilePath: () => '',
      getMetaFilePath: () => '',
    }));

    const createIndex = vi.fn().mockResolvedValue(undefined);
    const searchToArray = vi.fn().mockResolvedValue([]);
    const searchChain = { select: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray: searchToArray }) }) };
    const search = vi.fn().mockReturnValue(searchChain);
    const table = {
      createIndex,
      search,
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
        toArray: vi.fn().mockResolvedValue([]),
      }),
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

  it('falls back to plain query filtering when FTS setup/search fails', async () => {
    vi.resetModules();

    vi.doMock('apache-arrow', () => ({
      Schema: class Schema {},
      Field: class Field {},
      Utf8: class Utf8 {},
      Int32: class Int32 {},
      Int64: class Int64 {},
      Float32: class Float32 {},
      FixedSizeList: class FixedSizeList {},
      Bool: class Bool {},
    }));

    vi.doMock('../src/lib/config.js', () => ({
      getDBPath: () => ':memory:',
      getConfigDir: () => tmpDir,
      getDataDir: () => tmpDir,
      getMeta: (key: string) => key === 'schema_version' ? '5' : null,
      setMeta: () => {},
      getToken: () => null,
      saveToken: () => {},
      clearToken: () => {},
      getAuthFilePath: () => '',
      getMetaFilePath: () => '',
    }));

    const rows = [
      {
        id: 1,
        full_name: 'user/react-cli',
        name: 'react-cli',
        description: 'React command line helper',
        html_url: 'https://github.com/user/react-cli',
        homepage: '',
        language: 'TypeScript',
        topics: '["cli","react"]',
        topics_text: 'cli react',
        stars_count: 10,
        forks_count: 1,
        starred_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        starred_at_ts: Date.parse('2026-01-01T00:00:00Z'),
        updated_at_ts: Date.parse('2026-01-01T00:00:00Z'),
        has_embedding: false,
      },
      {
        id: 2,
        full_name: 'user/other',
        name: 'other',
        description: 'Other tool',
        html_url: 'https://github.com/user/other',
        homepage: '',
        language: 'TypeScript',
        topics: '["tailwind"]',
        topics_text: 'tailwind',
        stars_count: 5,
        forks_count: 1,
        starred_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        starred_at_ts: Date.parse('2026-01-01T00:00:00Z'),
        updated_at_ts: Date.parse('2026-01-01T00:00:00Z'),
        has_embedding: false,
      },
    ];
    const createIndex = vi.fn().mockRejectedValue(new Error('index unavailable'));
    const search = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(new Error('search unavailable')),
        }),
      }),
    });
    const table = {
      createIndex,
      search,
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(rows),
      }),
      countRows: vi.fn().mockResolvedValue(rows.length),
    };

    vi.doMock('@lancedb/lancedb', () => ({
      connect: vi.fn().mockResolvedValue({
        tableNames: vi.fn().mockResolvedValue(['repos']),
        openTable: vi.fn().mockResolvedValue(table),
      }),
    }));

    const { searchFTS } = await import('../src/lib/storage.js');
    const results = await searchFTS('react', 10, { topic: 'cli' });

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('react');
    expect(results.map(repo => repo.full_name)).toEqual(['user/react-cli']);
  });
});

describe('storage: schema migration internals', () => {
  it('backfills v2/v3/v4/v5 columns and persists the final schema version', async () => {
    vi.resetModules();

    vi.doMock('apache-arrow', () => ({
      Schema: class Schema {},
      Field: class Field {},
      Utf8: class Utf8 {},
      Int32: class Int32 {},
      Int64: class Int64 {},
      Float32: class Float32 {},
      FixedSizeList: class FixedSizeList {},
      Bool: class Bool {},
    }));

    const setMeta = vi.fn();
    vi.doMock('../src/lib/config.js', () => ({
      getDBPath: () => ':memory:',
      getConfigDir: () => tmpDir,
      getDataDir: () => tmpDir,
      getMeta: (key: string) => key === 'schema_version' ? '1' : null,
      setMeta,
      getToken: () => null,
      saveToken: () => {},
      clearToken: () => {},
      getAuthFilePath: () => '',
      getMetaFilePath: () => '',
    }));

    const baseRow = {
      id: 1,
      full_name: 'user/repo',
      name: 'repo',
      description: 'Repo',
      html_url: 'https://github.com/user/repo',
      homepage: '',
      language: 'TypeScript',
      topics: '["AI","Vector-Search"]',
      stars_count: 10,
      forks_count: 1,
      starred_at: '2026-01-02T03:04:05Z',
      updated_at: '2026-01-03T04:05:06Z',
      vector: new Array(1024).fill(0.1),
    };
    const execute = vi.fn().mockResolvedValue(undefined);
    const addColumns = vi.fn().mockResolvedValue(undefined);
    const optimize = vi.fn().mockResolvedValue(undefined);
    const table = {
      addColumns,
      optimize,
      mergeInsert: vi.fn().mockReturnValue({
        whenMatchedUpdateAll: vi.fn().mockReturnThis(),
        whenNotMatchedInsertAll: vi.fn().mockReturnThis(),
        execute,
      }),
      query: vi.fn().mockReturnValue({
        where: vi.fn((where: string) => ({
          toArray: vi.fn().mockResolvedValue(
            where === 'starred_at_ts = 0 OR updated_at_ts = 0'
              ? [{ ...baseRow, starred_at_ts: 0, updated_at_ts: 0 }]
              : where === "topics_text = '' AND topics != '[]'"
                ? [{ ...baseRow, starred_at_ts: Date.parse(baseRow.starred_at), updated_at_ts: Date.parse(baseRow.updated_at), topics_text: '' }]
                : where === 'has_embedding IS FALSE'
                  ? [{ ...baseRow, starred_at_ts: Date.parse(baseRow.starred_at), updated_at_ts: Date.parse(baseRow.updated_at), topics_text: 'ai vector-search', has_embedding: false }]
                  : where === "topics_key = '' AND topics != '[]'"
                    ? [{ ...baseRow, starred_at_ts: Date.parse(baseRow.starred_at), updated_at_ts: Date.parse(baseRow.updated_at), topics_text: 'ai vector-search', has_embedding: true, topics_key: '' }]
                    : []
          ),
        })),
      }),
      countRows: vi.fn().mockResolvedValue(1),
    };

    vi.doMock('@lancedb/lancedb', () => ({
      connect: vi.fn().mockResolvedValue({
        tableNames: vi.fn().mockResolvedValue(['repos']),
        openTable: vi.fn().mockResolvedValue(table),
      }),
    }));

    const { getTable } = await import('../src/lib/storage.js');
    await getTable();

    expect(addColumns).toHaveBeenCalledWith([{ name: 'starred_at_ts', valueSql: '0' }]);
    expect(addColumns).toHaveBeenCalledWith([{ name: 'updated_at_ts', valueSql: '0' }]);
    expect(addColumns).toHaveBeenCalledWith([{ name: 'topics_text', valueSql: "''" }]);
    expect(addColumns).toHaveBeenCalledWith([{ name: 'has_embedding', valueSql: 'cast(false as boolean)' }]);
    expect(addColumns).toHaveBeenCalledWith([{ name: 'topics_key', valueSql: "''" }]);
    expect(setMeta).toHaveBeenCalledWith('schema_version', '2');
    expect(setMeta).toHaveBeenCalledWith('schema_version', '3');
    expect(setMeta).toHaveBeenCalledWith('schema_version', '4');
    expect(setMeta).toHaveBeenCalledWith('schema_version', '5');
    expect(optimize).toHaveBeenCalledWith({ cleanupOlderThan: expect.any(Date) });

    const executedRows = execute.mock.calls.map((call) => call[0][0]);
    expect(executedRows).toEqual([
      expect.objectContaining({
        starred_at_ts: Date.parse(baseRow.starred_at),
        updated_at_ts: Date.parse(baseRow.updated_at),
      }),
      expect.objectContaining({
        topics_text: 'ai vector-search',
      }),
      expect.objectContaining({
        has_embedding: true,
      }),
      expect.objectContaining({
        topics_key: '|YWk|dmVjdG9yLXNlYXJjaA|',
      }),
    ]);
  });
});
