import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'starepo-status-test-'));
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

describe('collectStatus', () => {
  it('reports an empty local database without opening LanceDB', async () => {
    const { saveToken, setMeta } = await import('../src/lib/config.js');
    saveToken('test-token');
    setMeta('last_sync', '2026-01-01T00:00:00.000Z');
    setMeta('embedding_model', 'Xenova/bge-m3');
    setMeta('embedding_version', '2');

    const { collectStatus } = await import('../src/commands/status.js');
    const report = await collectStatus();

    expect(report.authenticated).toBe(true);
    expect(report.stars).toBe(0);
    expect(report.lastSync).toBe('2026-01-01T00:00:00.000Z');
    expect(report.database.ok).toBe(true);
    expect(report.embeddings).toMatchObject({
      embedded: 0,
      total: 0,
      missing: 0,
      model: 'Xenova/bge-m3',
      version: '2',
      status: 'current',
    });
  });

  it('reads live stats when a local database directory exists', async () => {
    const { getDBPath } = await import('../src/lib/config.js');
    mkdirSync(getDBPath(), { recursive: true });
    writeFileSync(join(getDBPath(), 'marker'), 'ok');

    vi.doMock('../src/lib/storage.js', () => ({
      getStats: vi.fn().mockResolvedValue({ count: 12, lastSync: '2026-02-01T00:00:00.000Z' }),
    }));
    vi.doMock('../src/lib/embeddings.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/embeddings.js')>('../src/lib/embeddings.js');
      return {
        ...actual,
        getEmbeddingStatus: vi.fn().mockResolvedValue({
          totalRepos: 12,
          embeddedRepos: 10,
          missingRepos: 2,
          metadataStatus: 'outdated',
          metadata: { model: 'legacy/model', version: '0' },
        }),
      };
    });

    const { collectStatus } = await import('../src/commands/status.js');
    const report = await collectStatus();

    expect(report.stars).toBe(12);
    expect(report.lastSync).toBe('2026-02-01T00:00:00.000Z');
    expect(report.embeddings).toMatchObject({
      embedded: 10,
      total: 12,
      missing: 2,
      status: 'outdated',
      model: 'legacy/model',
    });
  });

  it('marks the database as failed when stats cannot be read', async () => {
    const { getDBPath } = await import('../src/lib/config.js');
    mkdirSync(getDBPath(), { recursive: true });
    writeFileSync(join(getDBPath(), 'marker'), 'ok');

    vi.doMock('../src/lib/storage.js', () => ({
      getStats: vi.fn().mockRejectedValue(new Error('corrupt table')),
    }));
    vi.doMock('../src/lib/embeddings.js', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/embeddings.js')>('../src/lib/embeddings.js');
      return {
        ...actual,
        getEmbeddingStatus: vi.fn().mockRejectedValue(new Error('corrupt table')),
      };
    });

    const { collectStatus } = await import('../src/commands/status.js');
    const report = await collectStatus();

    expect(report.database.ok).toBe(false);
    expect(report.database.error).toBe('corrupt table');
    expect(report.stars).toBeNull();
    expect(report.embeddings).toBeNull();
  });
});

describe('runStatus', () => {
  it('prints JSON when requested', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });

    const { runStatus } = await import('../src/commands/status.js');
    await runStatus({ json: true });

    const parsed = JSON.parse(logs.join('\n')) as { stars: number; authenticated: boolean };
    expect(parsed.stars).toBe(0);
    expect(parsed.authenticated).toBe(false);
  });

  it('prints a text summary by default', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message?: string) => {
      logs.push(String(message ?? ''));
    });

    const { runStatus } = await import('../src/commands/status.js');
    await runStatus();

    expect(logs.join('\n')).toContain('Auth          no (run `starepo auth`)');
    expect(logs.join('\n')).toContain('Stars         0');
  });
});
