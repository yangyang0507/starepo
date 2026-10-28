import { formatRepoList, queryTerms, staleSyncHint } from '../lib/format.js';
import { hybridSearch } from '../lib/search.js';
import { parsePositiveIntOption, type SortField, type SortOrder } from '../lib/sort.js';
import { note, style, warn, writePaged } from '../lib/term.js';

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
  pager?: boolean;
  lastSync?: string | null;
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

  const count = `${results.length} ${results.length === 1 ? 'result' : 'results'}`;
  note(`${style.bold(count, process.stderr)}${style.gray(subject, process.stderr)}\n`);
  await writePaged(
    formatRepoList(results, {
      oneline: options.oneline,
      highlight: queryTerms(finalQuery),
      time: options.sort === 'updated' ? 'updated' : 'starred',
    }),
    { enabled: options.pager },
  );

  const hint = staleSyncHint(options.lastSync);
  if (hint) {
    note();
    warn(hint);
  }
}
