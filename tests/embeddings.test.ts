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

  it('marks embeddings as available when repos already have embeddings', async () => {
    const setHasEmbeddings = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      getReposWithoutEmbedding: vi.fn().mockResolvedValue([]),
      updateEmbedding: vi.fn(),
      setHasEmbeddings,
      getTable: vi.fn().mockResolvedValue({
        countRows: vi.fn().mockResolvedValue(1),
      }),
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    await generateAndStoreEmbeddings();

    expect(setHasEmbeddings).toHaveBeenCalledWith(true);
  });

  it('processes repos and reports progress to completion', async () => {
    const repos = [
      { ...baseRepo, full_name: 'user/a', topics: '["react"]' },
      { ...baseRepo, full_name: 'user/b', topics: '["vue"]' },
      { ...baseRepo, full_name: 'user/c', topics: '["svelte"]' },
    ];
    const updateEmbedding = vi.fn().mockResolvedValue(undefined);
    const setHasEmbeddings = vi.fn();
    const progress = vi.fn();

    vi.doMock('../src/lib/storage.js', () => ({
      getReposWithoutEmbedding: vi.fn().mockResolvedValue(repos),
      updateEmbedding,
      setHasEmbeddings,
      getTable: vi.fn(),
    }));
    vi.doMock('@xenova/transformers', () => ({
      env: {},
      pipeline: vi.fn().mockResolvedValue(
        vi.fn().mockResolvedValue({ data: new Float32Array(1024).fill(0.1) })
      ),
    }));

    const { generateAndStoreEmbeddings } = await import('../src/lib/embeddings.js');
    await generateAndStoreEmbeddings(progress);

    expect(updateEmbedding).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    expect(setHasEmbeddings).toHaveBeenCalledWith(true);
  });
});
