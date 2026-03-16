import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('runEmbed', () => {
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
});
