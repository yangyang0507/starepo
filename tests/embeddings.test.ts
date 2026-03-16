import { describe, it, expect, vi, beforeEach } from 'vitest';

const baseRepo = {
  name: 'awesome-lib',
  full_name: 'user/awesome-lib',
  description: 'An awesome library',
  topics: '["react","typescript"]',
  language: 'TypeScript',
};

describe('repoToText', () => {
  it('concatenates all fields', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText(baseRepo);
    expect(text).toContain('awesome-lib');
    expect(text).toContain('user/awesome-lib');
    expect(text).toContain('An awesome library');
    expect(text).toContain('react');
    expect(text).toContain('typescript');
    expect(text).toContain('TypeScript');
  });

  it('handles empty description', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText({ ...baseRepo, description: '' });
    expect(text).toContain('awesome-lib');
    expect(text).not.toContain('  '); // no double spaces from empty field
  });

  it('handles empty language', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText({ ...baseRepo, language: '' });
    expect(text).toContain('awesome-lib');
  });

  it('handles malformed topics JSON gracefully', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText({ ...baseRepo, topics: 'not-json' });
    expect(text).toContain('not-json');
  });

  it('handles empty topics array', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText({ ...baseRepo, topics: '[]' });
    expect(text).toContain('awesome-lib');
    expect(text).toContain('An awesome library');
  });

  it('joins topics with spaces', async () => {
    const { repoToText } = await import('../src/lib/embeddings.js');
    const text = repoToText({ ...baseRepo, topics: '["ai","ml","python"]' });
    expect(text).toContain('ai ml python');
  });
});

describe('generateAndStoreEmbeddings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('marks embeddings as available and stores metadata when repos already have embeddings', async () => {
    const setHasEmbeddings = vi.fn();
    const setMeta = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      getReposWithoutEmbedding: vi.fn().mockResolvedValue([]),
      getReposForEmbedding: vi.fn().mockResolvedValue([]),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(0),
      updateEmbeddingsBatch: vi.fn(),
      setHasEmbeddings,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(1),
      }),
      getStats: vi.fn().mockResolvedValue({ count: 1 }),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta,
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    await generateAndStoreEmbeddings();

    expect(setHasEmbeddings).toHaveBeenCalledWith(true);
    expect(setMeta).toHaveBeenCalledWith('embedding_model', 'Xenova/bge-m3');
    expect(setMeta).toHaveBeenCalledWith('embedding_version', '1');
  });

  it('processes repos, reports progress to completion, and stores metadata', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/a', topics: '["react"]' },
      { ...baseRepo, full_name: 'user/b', topics: '["vue"]' },
      { ...baseRepo, full_name: 'user/c', topics: '["svelte"]' },
    ];
    const updateEmbeddingsBatch = vi.fn().mockResolvedValue(undefined);
    const setHasEmbeddings = vi.fn();
    const setMeta = vi.fn();
    const progress = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      getReposWithoutEmbedding: vi.fn().mockResolvedValue(repos),
      getReposForEmbedding: vi.fn(),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(3),
      updateEmbeddingsBatch,
      setHasEmbeddings,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(3),
      }),
      getStats: vi.fn().mockResolvedValue({ count: 3 }),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta,
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    const generate = vi.fn().mockResolvedValue(new Array(1024).fill(0.1));
    await generateAndStoreEmbeddings({ onProgress: progress, generate });

    expect(updateEmbeddingsBatch).toHaveBeenCalledTimes(1);
    expect(updateEmbeddingsBatch).toHaveBeenCalledWith([
      { fullName: 'user/a', vector: new Array(1024).fill(0.1) },
      { fullName: 'user/b', vector: new Array(1024).fill(0.1) },
      { fullName: 'user/c', vector: new Array(1024).fill(0.1) },
    ]);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    expect(setHasEmbeddings).toHaveBeenCalledWith(true);
    expect(setMeta).toHaveBeenCalledWith('embedding_model', 'Xenova/bge-m3');
    expect(setMeta).toHaveBeenCalledWith('embedding_version', '1');
  });

  it('regenerates all repositories when force is enabled', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/a', topics: '["react"]' },
      { ...baseRepo, full_name: 'user/b', topics: '["vue"]' },
    ];
    const updateEmbeddingsBatch = vi.fn().mockResolvedValue(undefined);
    const setHasEmbeddings = vi.fn();
    const setMeta = vi.fn();
    const getReposForEmbedding = vi.fn().mockResolvedValue(repos);
    const getReposWithoutEmbedding = vi.fn().mockResolvedValue([
      repos[1],
    ]);

    vi.doMock('../src/lib/storage.js', () => ({
      getReposWithoutEmbedding,
      getReposForEmbedding,
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(1),
      updateEmbeddingsBatch,
      setHasEmbeddings,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(2),
      }),
      getStats: vi.fn().mockResolvedValue({ count: 2 }),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue('1'),
      setMeta,
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    const generate = vi.fn().mockResolvedValue(new Array(1024).fill(0.2));
    const result = await generateAndStoreEmbeddings({ force: true, generate });

    expect(getReposForEmbedding).toHaveBeenCalledTimes(1);
    expect(getReposWithoutEmbedding).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(updateEmbeddingsBatch).toHaveBeenCalledWith([
      { fullName: 'user/a', vector: new Array(1024).fill(0.2) },
      { fullName: 'user/b', vector: new Array(1024).fill(0.2) },
    ]);
    expect(result).toMatchObject({
      totalRepos: 2,
      processedRepos: 2,
      skippedRepos: 0,
      forced: true,
      metadataUpdated: true,
    });
  });

  it('reads embedding metadata from config', async () => {
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn((key: string) => {
        if (key === 'embedding_model') return 'Xenova/bge-m3';
        if (key === 'embedding_version') return '1';
        return null;
      }),
      setMeta: vi.fn(),
    }));

    const { getEmbeddingMetadata } = await import('../src/lib/embeddings.js');
    expect(getEmbeddingMetadata()).toEqual({
      model: 'Xenova/bge-m3',
      version: '1',
    });
  });

  it('reports outdated metadata status', async () => {
    vi.doMock('../src/lib/storage.js', () => ({
      getStats: vi.fn().mockResolvedValue({ count: 5 }),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(1),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn((key: string) => {
        if (key === 'embedding_model') return 'legacy/model';
        if (key === 'embedding_version') return '0';
        return null;
      }),
      setMeta: vi.fn(),
    }));

    const { getEmbeddingStatus } = await import('../src/lib/embeddings.js');
    await expect(getEmbeddingStatus()).resolves.toMatchObject({
      totalRepos: 5,
      embeddedRepos: 4,
      missingRepos: 1,
      metadataStatus: 'outdated',
      metadata: {
        model: 'legacy/model',
        version: '0',
      },
    });
  });
});
