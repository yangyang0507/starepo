import { Repo } from './storage.js';

export type SortField = 'stars' | 'forks' | 'starred' | 'updated' | 'relevance';
export type SortOrder = 'asc' | 'desc';

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
