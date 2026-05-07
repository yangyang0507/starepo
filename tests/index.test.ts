import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, type CliDeps } from '../src/index.js';
import { parseListOptions } from '../src/lib/sort.js';

function makeDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  return {
    runAuth: vi.fn(async () => 'token') as unknown as CliDeps['runAuth'],
    runSync: vi.fn(async () => {}) as unknown as CliDeps['runSync'],
    runSearch: vi.fn(async () => {}) as unknown as CliDeps['runSearch'],
    runList: vi.fn(async () => {}) as unknown as CliDeps['runList'],
    runInfo: vi.fn(async () => {}) as unknown as CliDeps['runInfo'],
    runServe: vi.fn(async () => {}) as unknown as CliDeps['runServe'],
    runEmbed: vi.fn(async () => {}) as unknown as CliDeps['runEmbed'],
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
  it('dispatches auth, sync, embed, info, and serve commands', async () => {
    const deps = makeDeps();

    await parseUserArgs(deps, ['auth', '--force']);
    await parseUserArgs(deps, ['sync', '--force', '--no-embeddings']);
    await parseUserArgs(deps, ['embed', '--force']);
    await parseUserArgs(deps, ['info', 'user/repo']);
    await parseUserArgs(deps, ['serve']);

    expect(deps.runAuth).toHaveBeenCalledWith({ force: true });
    expect(deps.runSync).toHaveBeenCalledWith({ force: true, noEmbeddings: true });
    expect(deps.runEmbed).toHaveBeenCalledWith({ force: true });
    expect(deps.runInfo).toHaveBeenCalledWith('user/repo');
    expect(deps.runServe).toHaveBeenCalledTimes(1);
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
    ]);

    expect(deps.getStats).toHaveBeenCalledTimes(1);
    expect(deps.runSearch).toHaveBeenCalledWith('semantic query', expect.objectContaining({
      language: 'TypeScript',
      topic: 'cli',
      limit: 7,
      sort: 'stars',
      order: 'asc',
      json: true,
    }));
  });

  it('exits search before parsing options when no local data exists', async () => {
    const deps = makeDeps({
      getStats: vi.fn(async () => ({ count: 0, lastSync: null })) as unknown as CliDeps['getStats'],
    });

    await expect(parseUserArgs(deps, ['search', 'react'])).rejects.toThrow('exit:1');

    expect(deps.log).toHaveBeenCalledWith('No local data found. Run `starepo sync` first.');
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
});
