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
      EMBEDDING_DIM: 1024,
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
    expect(setMeta).toHaveBeenCalledWith('embedding_version', '2');
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
      EMBEDDING_DIM: 1024,
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
    const generateBatch = vi.fn().mockResolvedValue([
      new Array(1024).fill(0.1),
      new Array(1024).fill(0.1),
      new Array(1024).fill(0.1),
    ]);
    await generateAndStoreEmbeddings({ onProgress: progress, generateBatch });

    expect(updateEmbeddingsBatch).toHaveBeenCalledTimes(1);
    expect(updateEmbeddingsBatch).toHaveBeenCalledWith([
      { fullName: 'user/a', vector: expect.any(Float32Array) },
      { fullName: 'user/b', vector: expect.any(Float32Array) },
      { fullName: 'user/c', vector: expect.any(Float32Array) },
    ]);
    const written = updateEmbeddingsBatch.mock.calls[0][0] as Array<{ fullName: string; vector: Float32Array }>;
    expect(written[0].vector[0]).toBeCloseTo(0.1);
    expect(generateBatch).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    expect(setHasEmbeddings).toHaveBeenCalledWith(true);
    expect(setMeta).toHaveBeenCalledWith('embedding_model', 'Xenova/bge-m3');
    expect(setMeta).toHaveBeenCalledWith('embedding_version', '2');
  });

  it('rejects generated vectors with the wrong dimension before writing', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/bad', topics: '["bad"]' },
    ];
    const updateEmbeddingsBatch = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      EMBEDDING_DIM: 1024,
      getReposWithoutEmbedding: vi.fn().mockResolvedValue(repos),
      getReposForEmbedding: vi.fn(),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(1),
      updateEmbeddingsBatch,
      setHasEmbeddings: vi.fn(),
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(1),
      }),
      getStats: vi.fn().mockResolvedValue({ count: 1 }),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta: vi.fn(),
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    await expect(generateAndStoreEmbeddings({
      generateBatch: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    })).rejects.toThrow('Generated embedding for user/bad must contain 1024 dimensions');

    expect(updateEmbeddingsBatch).not.toHaveBeenCalled();
  });

  it('propagates embedding write failures instead of swallowing them', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/a', topics: '["react"]' },
    ];
    const updateEmbeddingsBatch = vi.fn().mockRejectedValue(new Error('disk full'));
    const setHasEmbeddings = vi.fn();
    const setMeta = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      EMBEDDING_DIM: 1024,
      getReposWithoutEmbedding: vi.fn().mockResolvedValue(repos),
      getReposForEmbedding: vi.fn(),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(1),
      updateEmbeddingsBatch,
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
    await expect(generateAndStoreEmbeddings({
      generateBatch: vi.fn().mockResolvedValue([new Array(1024).fill(0.1)]),
    })).rejects.toThrow('disk full');

    expect(setHasEmbeddings).not.toHaveBeenCalled();
    expect(setMeta).not.toHaveBeenCalled();
  });

  it('writes copies of generated vectors so later buffer reuse cannot mutate pending writes', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/a', topics: '["react"]' },
    ];
    const vector = new Float32Array(1024);
    vector[0] = 0.5;
    const updateEmbeddingsBatch = vi.fn().mockImplementation(async (entries: Array<{ vector: Float32Array }>) => {
      vector.fill(0);
      expect(entries[0].vector[0]).toBeCloseTo(0.5);
    });

    vi.doMock('../src/lib/storage.js', () => ({
      EMBEDDING_DIM: 1024,
      getReposWithoutEmbedding: vi.fn().mockResolvedValue(repos),
      getReposForEmbedding: vi.fn(),
      countReposWithoutEmbedding: vi.fn().mockResolvedValue(1),
      updateEmbeddingsBatch,
      setHasEmbeddings: vi.fn(),
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(1),
      }),
      getStats: vi.fn().mockResolvedValue({ count: 1 }),
    }));
    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta: vi.fn(),
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    await generateAndStoreEmbeddings({
      generateBatch: vi.fn().mockResolvedValue([vector]),
    });

    expect(updateEmbeddingsBatch).toHaveBeenCalledTimes(1);
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
      EMBEDDING_DIM: 1024,
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
    const generateBatch = vi.fn().mockResolvedValue([
      new Array(1024).fill(0.2),
      new Array(1024).fill(0.2),
    ]);
    const result = await generateAndStoreEmbeddings({ force: true, generateBatch });

    expect(getReposForEmbedding).toHaveBeenCalledTimes(1);
    expect(getReposWithoutEmbedding).not.toHaveBeenCalled();
    expect(generateBatch).toHaveBeenCalledTimes(1);
    expect(updateEmbeddingsBatch).toHaveBeenCalledWith([
      { fullName: 'user/a', vector: expect.any(Float32Array) },
      { fullName: 'user/b', vector: expect.any(Float32Array) },
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
        if (key === 'embedding_version') return '2';
        return null;
      }),
      setMeta: vi.fn(),
    }));

    const { getEmbeddingMetadata } = await import('../src/lib/embeddings.js');
    expect(getEmbeddingMetadata()).toEqual({
      model: 'Xenova/bge-m3',
      version: '2',
    });
  });

  it('loads the q8 pipeline once for concurrent embedding requests', async () => {
    const pipe = vi.fn().mockResolvedValue({
      data: new Float32Array(1024).fill(0.1),
      dims: [1, 1024],
    });
    const pipeline = vi.fn().mockResolvedValue(pipe);
    const env = {} as { cacheDir?: string };

    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta: vi.fn(),
    }));
    vi.doMock('@huggingface/transformers', () => ({
      env,
      pipeline,
    }));

    const { generateEmbedding } = await import('../src/lib/embeddings.js');
    await Promise.all([
      generateEmbedding('repo one'),
      generateEmbedding('repo two'),
      generateEmbedding('repo three'),
    ]);

    expect(env.cacheDir).toBe('/tmp/starepo-test/models');
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/bge-m3', {
      dtype: 'q8',
      progress_callback: expect.any(Function),
    });
    expect(pipe).toHaveBeenCalledTimes(3);
  });

  it('forwards model download progress_total events to a Progress bar', async () => {
    const updates: number[] = [];
    const progress = {
      update: (done: number) => {
        updates.push(done);
      },
      finish: vi.fn(),
    };

    const { applyModelDownloadProgress } = await import('../src/lib/embeddings.js');
    const slot: { current?: { update: (done: number) => void; finish: () => void } } = {};
    applyModelDownloadProgress(
      { status: 'progress_total', loaded: 100, total: 400 },
      slot,
      () => progress as never,
    );
    applyModelDownloadProgress(
      { status: 'progress_total', loaded: 400, total: 400 },
      slot,
      () => progress as never,
    );
    applyModelDownloadProgress({ status: 'ready' }, slot, () => progress as never);

    expect(updates).toEqual([100, 400]);
    expect(progress.finish).toHaveBeenCalledTimes(1);
  });

  it('returns owned copies so later pipeline buffer reuse cannot mutate vectors', async () => {
    const data = new Float32Array(1024);
    data[0] = 0.5;
    const pipe = vi.fn().mockResolvedValue({
      data,
      dims: [1, 1024],
    });
    const pipeline = vi.fn().mockResolvedValue(pipe);
    const env = {} as { cacheDir?: string };

    vi.doMock('../src/lib/config.js', () => ({
      getDataDir: vi.fn().mockReturnValue('/tmp/starepo-test'),
      getMeta: vi.fn().mockReturnValue(null),
      setMeta: vi.fn(),
    }));
    vi.doMock('@huggingface/transformers', () => ({
      env,
      pipeline,
    }));

    const { generateEmbeddings } = await import('../src/lib/embeddings.js');
    const [vector] = await generateEmbeddings(['repo one']);
    data[0] = 0;

    expect(vector[0]).toBeCloseTo(0.5);
  });

  it('reports outdated metadata status', async () => {
    vi.doMock('../src/lib/storage.js', () => ({
      EMBEDDING_DIM: 1024,
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
