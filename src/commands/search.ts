import { hybridSearch } from '../lib/search.js';
import { Repo } from '../lib/storage.js';
import type { SortField, SortOrder } from '../lib/sort.js';

export interface SearchCommandOptions {
  query?: string;
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  limit?: number;
  sort?: SortField;
  order?: SortOrder;
  json?: boolean;
}

function formatRepo(repo: Repo, index: number): string {
  const topics = (() => {
    try { return (JSON.parse(repo.topics) as string[]).slice(0, 5).join(', '); }
    catch { return repo.topics; }
  })();
  const lines = [
    `${index + 1}. ${repo.full_name}${repo.language ? ` [${repo.language}]` : ''}`,
    `   ${repo.description ?? '(no description)'}`,
    `   ${repo.html_url}`,
  ];
  if (topics) lines.push(`   Topics: ${topics}`);
  lines.push(`   Stars: ${repo.stars_count}  Forks: ${repo.forks_count}`);
  return lines.join('\n');
}

export async function runSearch(query: string | undefined, options: SearchCommandOptions = {}): Promise<void> {
  const finalQuery = (query ?? options.query ?? '').trim();
  const limit = options.limit ?? 10;
  const hasStructuredFilters = Boolean(
    options.language || options.topic || options.starredAfter || options.starredBefore
  );

  if (!finalQuery && !hasStructuredFilters) {
    console.error('Please provide a query (positional or --query), or at least one filter (--lang/--topic/--since/--until/--days).');
    process.exit(1);
  }

  if (finalQuery) {
    console.log(`Searching for: "${finalQuery}"...`);
  } else {
    console.log('Searching with structured filters only...');
  }

  const results = await hybridSearch(finalQuery, limit, {
    language: options.language,
    topic: options.topic,
    starredAfter: options.starredAfter,
    starredBefore: options.starredBefore,
    sort: options.sort,
    order: options.order,
  });

  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(results.map(({ vector: _, ...r }) => r), null, 2));
    return;
  }

  console.log(`\nFound ${results.length} result(s):\n`);
  results.forEach((repo, i) => {
    console.log(formatRepo(repo, i));
    console.log();
  });
}
