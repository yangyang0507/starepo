import { Repo } from './storage.js';
import { resolveStarredTimeRange } from './time.js';

export type SortField = 'stars' | 'forks' | 'starred' | 'updated' | 'relevance';
export type SortOrder = 'asc' | 'desc';

const VALID_SORT_FIELDS: SortField[] = ['stars', 'forks', 'starred', 'updated', 'relevance'];
const VALID_ORDERS: SortOrder[] = ['asc', 'desc'];

export function sortRepos(repos: Repo[], sort: SortField, order: SortOrder): Repo[] {
  if (sort === 'relevance') return repos;

  const getValue = (repo: Repo): number => {
    switch (sort) {
      case 'stars':   return repo.stars_count ?? 0;
      case 'forks':   return repo.forks_count ?? 0;
      case 'starred': return repo.starred_at_ts ?? (repo.starred_at ? new Date(repo.starred_at).getTime() : 0);
      case 'updated': return repo.updated_at_ts ?? (repo.updated_at ? new Date(repo.updated_at).getTime() : 0);
    }
  };

  const sorted = [...repos].sort((a, b) => getValue(a) - getValue(b));
  return order === 'desc' ? sorted.reverse() : sorted;
}

export interface ParsedListOptions {
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  limit: number;
  sort?: SortField;
  order?: SortOrder;
  json?: boolean;
}

export interface RawListOptions {
  lang?: string;
  topic?: string;
  since?: string;
  until?: string;
  days?: string;
  limit: string;
  sort?: string;
  order?: string;
  json?: boolean;
}

export function parseListOptions(opts: RawListOptions): ParsedListOptions {
  if (opts.sort && !VALID_SORT_FIELDS.includes(opts.sort as SortField)) {
    throw new Error(`Invalid --sort value "${opts.sort}". Must be one of: ${VALID_SORT_FIELDS.join(', ')}`);
  }
  if (opts.order && !VALID_ORDERS.includes(opts.order as SortOrder)) {
    throw new Error(`Invalid --order value "${opts.order}". Must be one of: ${VALID_ORDERS.join(', ')}`);
  }

  const days = opts.days !== undefined ? parseFloat(opts.days) : undefined;
  const range = resolveStarredTimeRange({ since: opts.since, until: opts.until, days });

  return {
    language: opts.lang,
    topic: opts.topic,
    starredAfter: range.starredAfter,
    starredBefore: range.starredBefore,
    limit: parseInt(opts.limit, 10),
    sort: opts.sort as SortField | undefined,
    order: opts.order as SortOrder | undefined,
    json: opts.json,
  };
}
