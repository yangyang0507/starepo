import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('runEmbed', () => {
  it('prints sync guidance when there are no repositories', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    const generateAndStoreEmbeddings = vi.fn();

    vi.doMock('../src/lib/embeddings.js', () => ({
      EMBEDDING_MODEL: 'Xenova/bge-m3',
      EMBEDDING_VERSION: '1',
      getEmbeddingStatus: vi.fn().mockResolvedValue({
        totalRepos: 0,
        embeddedRepos: 0,
        missingRepos: 0,
        metadataStatus: 'missing',
        metadata: { model: null, version: null },
      }),
      generateAndStoreEmbeddings,
    }));

    const { runEmbed } = await import('../src/commands/embed.js');
    await runEmbed();

    expect(logs.join('\n')).toContain('Run `starepo sync` first.');
    expect(generateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('skips regeneration when embeddings are complete and metadata is current', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    const generateAndStoreEmbeddings = vi.fn();

    vi.doMock('../src/lib/embeddings.js', () => ({
      EMBEDDING_MODEL: 'Xenova/bge-m3',
      EMBEDDING_VERSION: '1',
      getEmbeddingStatus: vi.fn().mockResolvedValue({
        totalRepos: 3,
        embeddedRepos: 3,
        missingRepos: 0,
        metadataStatus: 'current',
        metadata: { model: 'Xenova/bge-m3', version: '1' },
      }),
      generateAndStoreEmbeddings,
    }));

    const { runEmbed } = await import('../src/commands/embed.js');
    await runEmbed();

    expect(logs.join('\n')).toContain('All repositories already have embeddings.');
    expect(logs.join('\n')).toContain('Use --force to regenerate all embeddings.');
    expect(generateAndStoreEmbeddings).not.toHaveBeenCalled();
  });

  it('advises force rebuild when embeddings are complete but metadata is outdated', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    vi.doMock('../src/lib/embeddings.js', () => ({
      EMBEDDING_MODEL: 'Xenova/bge-m3',
      EMBEDDING_VERSION: '1',
      getEmbeddingStatus: vi.fn().mockResolvedValue({
        totalRepos: 5,
        embeddedRepos: 5,
        missingRepos: 0,
        metadataStatus: 'outdated',
        metadata: { model: 'legacy/model', version: '0' },
      }),
      generateAndStoreEmbeddings: vi.fn(),
    }));

    const { runEmbed } = await import('../src/commands/embed.js');
    await runEmbed();

    expect(logs.join('\n')).toContain('starepo embed --force');
  });

  it('forwards force mode to embedding generation', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const generateAndStoreEmbeddings = vi.fn().mockResolvedValue({
      totalRepos: 5,
      processedRepos: 5,
      skippedRepos: 0,
      forced: true,
      metadataUpdated: true,
      metadataStatusBefore: 'outdated',
    });

    vi.doMock('../src/lib/embeddings.js', () => ({
      EMBEDDING_MODEL: 'Xenova/bge-m3',
      EMBEDDING_VERSION: '1',
      getEmbeddingStatus: vi.fn().mockResolvedValue({
        totalRepos: 5,
        embeddedRepos: 4,
        missingRepos: 1,
        metadataStatus: 'outdated',
        metadata: { model: 'legacy/model', version: '0' },
      }),
      generateAndStoreEmbeddings,
    }));

    const { runEmbed } = await import('../src/commands/embed.js');
    await runEmbed({ force: true });

    expect(generateAndStoreEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        onProgress: expect.any(Function),
      })
    );
    expect(logs.join('\n')).toContain('Regenerating embeddings for 5 repositories...');
    expect(logs.join('\n')).toContain('Processed 5 repositories.');
  });

  it('generates only missing embeddings and reports skipped repos', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const generateAndStoreEmbeddings = vi.fn().mockResolvedValue({
      totalRepos: 5,
      processedRepos: 2,
      skippedRepos: 3,
      forced: false,
      metadataUpdated: true,
      metadataStatusBefore: 'missing',
    });

    vi.doMock('../src/lib/embeddings.js', () => ({
      EMBEDDING_MODEL: 'Xenova/bge-m3',
      EMBEDDING_VERSION: '1',
      getEmbeddingStatus: vi.fn().mockResolvedValue({
        totalRepos: 5,
        embeddedRepos: 3,
        missingRepos: 2,
        metadataStatus: 'missing',
        metadata: { model: null, version: null },
      }),
      generateAndStoreEmbeddings,
    }));

    const { runEmbed } = await import('../src/commands/embed.js');
    await runEmbed();

    expect(generateAndStoreEmbeddings).toHaveBeenCalledWith({
      force: undefined,
      onProgress: expect.any(Function),
    });
    expect(logs.join('\n')).toContain('Generating embeddings for 2 repositories...');
    expect(logs.join('\n')).toContain('Skipped 3 repositories that already had embeddings.');
    expect(logs.join('\n')).toContain('Embedding coverage is now 5/5.');
  });
});
