#!/usr/bin/env node
import { Command } from 'commander';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { runAuth } from './commands/auth.js';
import { runSync } from './commands/sync.js';
import { runSearch } from './commands/search.js';
import { runList, runInfo } from './commands/list.js';
import { runEmbed } from './commands/embed.js';
import { runStatus } from './commands/status.js';
import { getStats } from './lib/storage.js';
import { parseListOptions } from './lib/sort.js';
import { VERSION } from './lib/version.js';

export interface CliDeps {
  runAuth: typeof runAuth;
  runSync: typeof runSync;
  runSearch: typeof runSearch;
  runList: typeof runList;
  runInfo: typeof runInfo;
  runEmbed: typeof runEmbed;
  runStatus: typeof runStatus;
  getStats: typeof getStats;
  parseListOptions: typeof parseListOptions;
  version: string;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
}

const defaultDeps: CliDeps = {
  runAuth,
  runSync,
  runSearch,
  runList,
  runInfo,
  runEmbed,
  runStatus,
  getStats,
  parseListOptions,
  version: VERSION,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number): never => process.exit(code),
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createProgram(deps: CliDeps = defaultDeps): Command {
  const program = new Command();

  program
    .name('starepo')
    .description('Search your GitHub stars with semantic search')
    .version(deps.version);

  program
    .command('auth')
    .description('Authenticate with GitHub (runs automatically on first use)')
    .option('-f, --force', 'Force re-authentication even if already logged in')
    .action(async (opts) => {
      await deps.runAuth({ force: opts.force });
    });

  program
    .command('sync')
    .description('Sync your GitHub starred repositories')
    .option('-f, --force', 'Force a full reconcile (default)')
    .option('--incremental', 'Only fetch stars since last sync; skip metadata and unstar cleanup')
    .option('--no-embeddings', 'Skip generating embeddings after sync')
    .action(async (opts) => {
      await deps.runSync({
        force: opts.force,
        incremental: opts.incremental,
        noEmbeddings: !opts.embeddings,
      });
    });

  program
    .command('embed')
    .description('Generate embeddings for semantic search')
    .option('-f, --force', 'Regenerate all embeddings (even if they exist)')
    .action(async (opts) => {
      await deps.runEmbed({ force: opts.force });
    });

  program
    .command('search [query]')
    .description('Search your starred repositories')
    .option('-q, --query <query>', 'Search query (same as positional <query>)')
    .option('-l, --lang <language>', 'Filter by programming language')
    .option('-t, --topic <topic>', 'Filter by topic tag')
    .option('--since <date>', 'Filter stars on/after date (e.g. 2026-03-01)')
    .option('--until <date>', 'Filter stars on/before date (e.g. 2026-03-08)')
    .option('--days <number>', 'Filter stars from the last N days')
    .option('-n, --limit <number>', 'Max number of results', '10')
    .option('--sort <field>', 'Sort by: stars, forks, starred, updated, relevance (default: relevance)')
    .option('--order <direction>', 'Sort direction: asc or desc (default: desc)')
    .option('--json', 'Output as JSON')
    .option('--oneline', 'Print each result on one line')
    .action(async (query: string | undefined, opts) => {
      try {
        const { count } = await deps.getStats();
        if (count === 0) {
          deps.log('No local data found. Run `starepo sync` first.');
          deps.exit(1);
        }
        const parsed = deps.parseListOptions(opts);
        await deps.runSearch(query, {
          query: opts.query,
          ...parsed,
          oneline: opts.oneline,
        });
      } catch (err) {
        deps.error(errorMessage(err));
        deps.exit(1);
      }
    });

  program
    .command('list')
    .description('List your starred repositories')
    .option('-q, --query <query>', 'Search query (keyword or semantic)')
    .option('-l, --lang <language>', 'Filter by programming language')
    .option('-t, --topic <topic>', 'Filter by topic tag')
    .option('--since <date>', 'Filter stars on/after date (e.g. 2026-03-01)')
    .option('--until <date>', 'Filter stars on/before date (e.g. 2026-03-08)')
    .option('--days <number>', 'Filter stars from the last N days')
    .option('-n, --limit <number>', 'Max number of results', '50')
    .option('--sort <field>', 'Sort by: stars, forks, starred, updated (default: starred)')
    .option('--order <direction>', 'Sort direction: asc or desc (default: desc)')
    .option('--json', 'Output as JSON')
    .option('--oneline', 'Print each result on one line')
    .action(async (opts) => {
      try {
        const parsed = deps.parseListOptions(opts);
        await deps.runList({
          query: opts.query,
          ...parsed,
          oneline: opts.oneline,
        });
      } catch (err) {
        deps.error(errorMessage(err));
        deps.exit(1);
      }
    });

  program
    .command('info <owner/repo>')
    .description('Show detailed info about a starred repository')
    .action(async (fullName: string) => {
      await deps.runInfo(fullName);
    });

  program
    .command('status')
    .description('Show local sync, embedding, and database status')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      try {
        await deps.runStatus({ json: opts.json });
      } catch (err) {
        deps.error(errorMessage(err));
        deps.exit(1);
      }
    });

  return program;
}

export async function runCli(argv = process.argv, deps: CliDeps = defaultDeps): Promise<void> {
  await createProgram(deps).parseAsync(argv);
}

function realpathOrOriginal(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function isDirectRun(importMetaUrl: string, argvPath = process.argv[1]): boolean {
  if (!argvPath) return false;
  return realpathOrOriginal(fileURLToPath(importMetaUrl)) === realpathOrOriginal(argvPath);
}

if (isDirectRun(import.meta.url)) {
  runCli().catch((err: unknown) => {
    console.error(errorMessage(err));
    process.exit(1);
  });
}
