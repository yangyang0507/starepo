import { formatRepo } from '../lib/format.js';
import { hybridSearch } from '../lib/search.js';
import { parsePositiveIntOption, type SortField, type SortOrder } from '../lib/sort.js';
import { note } from '../lib/term.js';

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
    throw new Error('Please provide a query (positional or --query), or at least one filter (--lang/--topic/--since/--until/--days).');
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

  const subject = finalQuery ? ` for "${finalQuery}"` : '';
  if (results.length === 0) {
    note(`No results found${subject}.`);
    return;
  }

  note(`Found ${results.length} result(s)${subject}:`);
  results.forEach((repo, i) => {
    console.log(formatRepo(repo, { index: i, oneline: options.oneline }));
    if (!options.oneline) console.log();
  });
}
