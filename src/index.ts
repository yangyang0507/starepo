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
import { SortField, SortOrder } from './lib/sort.js';
import { VERSION } from './lib/version.js';

const program = new Command();

program
  .name('starepo')
  .description('Search your GitHub stars with semantic search and MCP server support')
  .version(VERSION);

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
  .option('--sort <field>', 'Sort by: stars, forks, starred, updated, relevance (default: relevance)')
  .option('--order <direction>', 'Sort direction: asc or desc (default: desc)')
  .option('--json', 'Output as JSON')
  .action(async (query: string | undefined, opts) => {
    try {
      const { count } = await getStats();
      if (count === 0) {
        console.log('No local data found. Run `starepo sync` first.');
        process.exit(1);
      }
      const validSortFields: SortField[] = ['stars', 'forks', 'starred', 'updated', 'relevance'];
      const validOrders: SortOrder[] = ['asc', 'desc'];
      if (opts.sort && !validSortFields.includes(opts.sort)) {
        console.error(`Invalid --sort value "${opts.sort}". Must be one of: ${validSortFields.join(', ')}`);
        process.exit(1);
      }
      if (opts.order && !validOrders.includes(opts.order)) {
        console.error(`Invalid --order value "${opts.order}". Must be one of: ${validOrders.join(', ')}`);
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
        sort: opts.sort as SortField | undefined,
        order: opts.order as SortOrder | undefined,
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
  .option('--sort <field>', 'Sort by: stars, forks, starred, updated (default: starred)')
  .option('--order <direction>', 'Sort direction: asc or desc (default: desc)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const validSortFields: SortField[] = ['stars', 'forks', 'starred', 'updated', 'relevance'];
      const validOrders: SortOrder[] = ['asc', 'desc'];
      if (opts.sort && !validSortFields.includes(opts.sort)) {
        console.error(`Invalid --sort value "${opts.sort}". Must be one of: ${validSortFields.join(', ')}`);
        process.exit(1);
      }
      if (opts.order && !validOrders.includes(opts.order)) {
        console.error(`Invalid --order value "${opts.order}". Must be one of: ${validOrders.join(', ')}`);
        process.exit(1);
      }
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
        sort: opts.sort as SortField | undefined,
        order: opts.order as SortOrder | undefined,
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
