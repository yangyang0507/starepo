import { formatRepo } from '../lib/format.js';
import { hybridSearch } from '../lib/search.js';
import { parsePositiveIntOption, type SortField, type SortOrder } from '../lib/sort.js';
import { writeBanner } from '../lib/term.js';

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
  oneline?: boolean;
}

export async function runSearch(query: string | undefined, options: SearchCommandOptions = {}): Promise<void> {
  const finalQuery = (query ?? options.query ?? '').trim();
  const limit = parsePositiveIntOption(options.limit ?? 10, 'limit');
  const hasStructuredFilters = Boolean(
    options.language || options.topic || options.starredAfter || options.starredBefore
  );

  if (!finalQuery && !hasStructuredFilters) {
    console.error('Please provide a query (positional or --query), or at least one filter (--lang/--topic/--since/--until/--days).');
    process.exit(1);
  }

  if (finalQuery) {
    writeBanner(`Searching for: "${finalQuery}"...`);
  } else {
    writeBanner('Searching with structured filters only...');
  }

  const results = await hybridSearch(finalQuery, limit, {
    language: options.language,
    topic: options.topic,
    starredAfter: options.starredAfter,
    starredBefore: options.starredBefore,
    sort: options.sort,
    order: options.order,
  });

  if (options.json) {
    console.log(JSON.stringify(results.map(({ vector: _, ...r }) => r), null, 2));
    return;
  }

  if (results.length === 0) {
    console.log('No results found.');
    return;
  }

  writeBanner(`Found ${results.length} result(s):`);
  results.forEach((repo, i) => {
    console.log(formatRepo(repo, { index: i, oneline: options.oneline }));
    if (!options.oneline) console.log();
  });
}
