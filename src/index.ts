#!/usr/bin/env node
import { Command } from 'commander';
import { runAuth } from './commands/auth.js';
import { runSync } from './commands/sync.js';
import { runSearch } from './commands/search.js';
import { runList, runInfo } from './commands/list.js';
import { runServe } from './commands/serve.js';
import { runEmbed } from './commands/embed.js';
import { getStats } from './lib/storage.js';
import { resolveStarredTimeRange } from './lib/time.js';

const program = new Command();

program
  .name('starepo')
  .description('Search your GitHub stars with semantic search and MCP server support')
  .version('0.1.0');

program
  .command('auth')
  .description('Authenticate with GitHub (runs automatically on first use)')
  .option('-f, --force', 'Force re-authentication even if already logged in')
  .action(async (opts) => {
    await runAuth({ force: opts.force });
  });

program
  .command('sync')
  .description('Sync your GitHub starred repositories')
  .option('-i, --incremental', 'Only fetch new stars since last sync')
  .option('--no-embeddings', 'Skip generating embeddings after sync')
  .action(async (opts) => {
    await runSync({ incremental: opts.incremental, noEmbeddings: !opts.embeddings });
  });

program
  .command('embed')
  .description('Generate embeddings for semantic search')
  .option('-f, --force', 'Regenerate all embeddings (even if they exist)')
  .action(async (opts) => {
    await runEmbed({ force: opts.force });
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
  .option('--json', 'Output as JSON')
  .action(async (query: string | undefined, opts) => {
    try {
      const { count } = await getStats();
      if (count === 0) {
        console.log('No local data found. Run `starepo sync` first.');
        process.exit(1);
      }
      const days = opts.days !== undefined ? parseFloat(opts.days) : undefined;
      const range = resolveStarredTimeRange({
        since: opts.since,
        until: opts.until,
        days,
      });
      await runSearch(query, {
        query: opts.query,
        language: opts.lang,
        topic: opts.topic,
        starredAfter: range.starredAfter,
        starredBefore: range.starredBefore,
        limit: parseInt(opts.limit, 10),
        json: opts.json,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exit(1);
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
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const days = opts.days !== undefined ? parseFloat(opts.days) : undefined;
      const range = resolveStarredTimeRange({
        since: opts.since,
        until: opts.until,
        days,
      });
      await runList({
        query: opts.query,
        language: opts.lang,
        topic: opts.topic,
        starredAfter: range.starredAfter,
        starredBefore: range.starredBefore,
        limit: parseInt(opts.limit, 10),
        json: opts.json,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exit(1);
    }
  });

program
  .command('info <owner/repo>')
  .description('Show detailed info about a starred repository')
  .action(async (fullName: string) => {
    await runInfo(fullName);
  });

program
  .command('serve')
  .description('Start the MCP server (stdio mode for Claude Desktop / Cursor)')
  .action(async () => {
    await runServe();
  });

program.parse();
