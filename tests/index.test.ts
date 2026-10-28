import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, isDirectRun, type CliDeps } from '../src/index.js';
import { parseListOptions } from '../src/lib/sort.js';

function makeDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    runAuth: vi.fn(async () => 'token') as unknown as CliDeps['runAuth'],
    runSync: vi.fn(async () => {}) as unknown as CliDeps['runSync'],
    runSearch: vi.fn(async () => {}) as unknown as CliDeps['runSearch'],
    runList: vi.fn(async () => {}) as unknown as CliDeps['runList'],
    runInfo: vi.fn(async () => {}) as unknown as CliDeps['runInfo'],
    runEmbed: vi.fn(async () => {}) as unknown as CliDeps['runEmbed'],
    runStatus: vi.fn(async () => {}) as unknown as CliDeps['runStatus'],
    getStats: vi.fn(async () => ({ count: 1, lastSync: null })) as unknown as CliDeps['getStats'],
    parseListOptions,
    version: '9.9.9-test',
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn((code: number) => {
      throw new Error(`exit:${code}`);
    }) as unknown as CliDeps['exit'],
    ...overrides,
  };
}

async function parseUserArgs(deps: CliDeps, args: string[]): Promise<void> {
  await createProgram(deps).parseAsync(args, { from: 'user' });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createProgram', () => {
  it('dispatches auth, sync, embed, and info commands', async () => {
    const deps = makeDeps();

    await parseUserArgs(deps, ['auth', '--force']);
    await parseUserArgs(deps, ['sync', '--force', '--no-embeddings']);
    await parseUserArgs(deps, ['sync', '--incremental', '--no-embeddings']);
    await parseUserArgs(deps, ['embed', '--force']);
    await parseUserArgs(deps, ['info', 'user/repo']);
    await parseUserArgs(deps, ['status', '--json']);

    expect(deps.runAuth).toHaveBeenCalledWith({ force: true });
    expect(deps.runSync).toHaveBeenCalledWith({ force: true, incremental: undefined, noEmbeddings: true });
    expect(deps.runSync).toHaveBeenCalledWith({ force: undefined, incremental: true, noEmbeddings: true });
    expect(deps.runEmbed).toHaveBeenCalledWith({ force: true });
    expect(deps.runInfo).toHaveBeenCalledWith('user/repo');
    expect(deps.runStatus).toHaveBeenCalledWith({ json: true });
  });

  it('reports failures from any command as a single error line and exit 1', async () => {
    const deps = makeDeps({
      runInfo: vi.fn(async () => {
        throw new Error('Repository "x/y" not found in your stars.');
      }) as unknown as CliDeps['runInfo'],
    });

    await expect(parseUserArgs(deps, ['info', 'x/y'])).rejects.toThrow('exit:1');

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('error: Repository "x/y" not found'));
  });

  it('parses search options and checks local data before dispatching', async () => {
    const deps = makeDeps();

    await parseUserArgs(deps, [
      'search',
      'semantic query',
      '--lang',
      'TypeScript',
      '--topic',
      'cli',
      '--since',
      '2026-01-01',
      '--limit',
      '7',
      '--sort',
      'stars',
      '--order',
      'asc',
      '--json',
      '--oneline',
    ]);

    expect(deps.getStats).toHaveBeenCalledTimes(1);
    expect(deps.runSearch).toHaveBeenCalledWith('semantic query', expect.objectContaining({
      language: 'TypeScript',
      topic: 'cli',
      limit: 7,
      sort: 'stars',
      order: 'asc',
      json: true,
      oneline: true,
    }));
  });

  it('exits search before parsing options when no local data exists', async () => {
    const deps = makeDeps({
      getStats: vi.fn(async () => ({ count: 0, lastSync: null })) as unknown as CliDeps['getStats'],
    });

    await expect(parseUserArgs(deps, ['search', 'react'])).rejects.toThrow('exit:1');

    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('No local data found. Run `starepo sync` first.'));
    expect(deps.runSearch).not.toHaveBeenCalled();
  });

  it('parses list options and reports parser errors through the CLI error path', async () => {
    const deps = makeDeps();

    await parseUserArgs(deps, ['list', '--query', 'cli', '--limit', '4', '--json']);
    await expect(parseUserArgs(deps, ['list', '--sort', 'bad-field'])).rejects.toThrow('exit:1');

    expect(deps.runList).toHaveBeenCalledWith(expect.objectContaining({
      query: 'cli',
      limit: 4,
      json: true,
    }));
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('Invalid --sort value'));
  });

  it('recognizes npm global bin symlinks as direct CLI execution', () => {
    const dir = mkdtempSync(join(tmpdir(), 'starepo-cli-'));
    const target = join(dir, 'index.js');
    const symlink = join(dir, 'starepo');

    try {
      writeFileSync(target, '');
      symlinkSync(target, symlink);

      expect(isDirectRun(pathToFileURL(target).href, symlink)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
