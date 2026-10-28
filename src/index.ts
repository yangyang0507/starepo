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
import { runBrowse } from './commands/browse.js';
import { getStats } from './lib/storage.js';
import { parseListOptions } from './lib/sort.js';
import { style } from './lib/term.js';
import { VERSION } from './lib/version.js';

export interface CliDeps {
  runAuth: typeof runAuth;
  runSync: typeof runSync;
  runSearch: typeof runSearch;
  runList: typeof runList;
  runInfo: typeof runInfo;
  runEmbed: typeof runEmbed;
  runStatus: typeof runStatus;
  runBrowse: typeof runBrowse;
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
  runBrowse,
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

function formatError(err: unknown): string {
  return `${style.red('error', process.stderr)}: ${errorMessage(err)}`;
}

export function createProgram(deps: CliDeps = defaultDeps): Command {
  const program = new Command();

  // Every command reports failures the same way: one red line on stderr, exit 1.
  const action = <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) =>
    async (...args: A): Promise<void> => {
      try {
        await fn(...args);
      } catch (err) {
        deps.error(formatError(err));
        deps.exit(1);
      }
    };

  program
    .name('starepo')
    .description('Search your GitHub stars with semantic search')
    .version(deps.version);

  program
    .command('auth')
    .description('Authenticate with GitHub (runs automatically on first use)')
    .option('-f, --force', 'Force re-authentication even if already logged in')
    .action(action(async (opts) => {
      await deps.runAuth({ force: opts.force });
    }));

  program
    .command('sync')
    .description('Sync your GitHub starred repositories')
    .option('-f, --force', 'Force a full reconcile (default)')
    .option('--incremental', 'Only fetch stars since last sync; skip metadata and unstar cleanup')
    .option('--no-embeddings', 'Skip generating embeddings after sync')
    .action(action(async (opts) => {
      await deps.runSync({
        force: opts.force,
        incremental: opts.incremental,
        noEmbeddings: !opts.embeddings,
      });
    }));

  program
    .command('embed')
    .description('Generate embeddings for semantic search')
    .option('-f, --force', 'Regenerate all embeddings (even if they exist)')
    .action(action(async (opts) => {
      await deps.runEmbed({ force: opts.force });
    }));

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
    .option('--no-pager', 'Do not page long output through $PAGER')
    .action(action(async (query: string | undefined, opts) => {
      const { count, lastSync } = await deps.getStats();
      if (count === 0) {
        throw new Error('No local data found. Run `starepo sync` first.');
      }
      const parsed = deps.parseListOptions(opts);
      await deps.runSearch(query, {
        query: opts.query,
        ...parsed,
        oneline: opts.oneline,
        pager: opts.pager,
        lastSync,
      });
    }));

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
    .option('--no-pager', 'Do not page long output through $PAGER')
    .action(action(async (opts) => {
      const parsed = deps.parseListOptions(opts);
      await deps.runList({
        query: opts.query,
        ...parsed,
        oneline: opts.oneline,
        pager: opts.pager,
      });
    }));

  program
    .command('info <owner/repo>')
    .description('Show detailed info about a starred repository')
    .action(action(async (fullName: string) => {
      await deps.runInfo(fullName);
    }));

  program
    .command('browse [query]')
    .description('Browse and search your stars interactively (default when run with no arguments in a terminal)')
    .action(action(async (query: string | undefined) => {
      await deps.runBrowse(query ?? '');
    }));

  program
    .command('status')
    .description('Show local sync, embedding, and database status')
    .option('--json', 'Output as JSON')
    .action(action(async (opts) => {
      await deps.runStatus({ json: opts.json });
    }));

  return program;
}

export async function runCli(
  argv = process.argv,
  deps: CliDeps = defaultDeps,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
): Promise<void> {
  // A bare `starepo` in a terminal opens the browser UI; elsewhere it prints help.
  const args = argv.length <= 2 && interactive ? [...argv, 'browse'] : argv;
  await createProgram(deps).parseAsync(args);
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
    console.error(formatError(err));
    process.exit(1);
  });
}
