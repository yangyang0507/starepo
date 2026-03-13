import { Repo, listRepos, searchVector, searchFTS } from './storage.js';
import { sortRepos, SortField, SortOrder } from './sort.js';

export interface SearchOptions {
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  sort?: SortField;
  order?: SortOrder;
}

type SearchFilterOptions = Pick<SearchOptions, 'language' | 'topic' | 'starredAfter' | 'starredBefore'>;

function dedup(repos: Repo[]): Repo[] {
  const seen = new Set<string>();
  return repos.filter(r => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });
}

function applyFilters(repos: Repo[], filters: SearchFilterOptions): Repo[] {
  return repos.filter((repo) => {
    if (filters.language && repo.language.toLowerCase() !== filters.language.toLowerCase()) {
      return false;
    }
    if (filters.topic && !repo.topics.toLowerCase().includes(filters.topic.toLowerCase())) {
      return false;
    }

    if (filters.starredAfter || filters.starredBefore) {
      const starredAt = repo.starred_at ? new Date(repo.starred_at).getTime() : NaN;
      if (Number.isNaN(starredAt)) return false;

      if (filters.starredAfter) {
        const after = new Date(filters.starredAfter).getTime();
        if (!Number.isNaN(after) && starredAt < after) return false;
      }
      if (filters.starredBefore) {
        const before = new Date(filters.starredBefore).getTime();
        if (!Number.isNaN(before) && starredAt > before) return false;
      }
    }

    return true;
  });
}

export async function hybridSearch(query: string, limit = 20, options: SearchOptions = {}): Promise<Repo[]> {
  const trimmed = query.trim();
  const sort = options.sort ?? 'relevance';
  const order = options.order ?? 'desc';
  const hasStructuredFilters = Boolean(
    options.language || options.topic || options.starredAfter || options.starredBefore
  );

  if (!trimmed) {
    const repos = await listRepos({
      language: options.language,
      topic: options.topic,
      starredAfter: options.starredAfter,
      starredBefore: options.starredBefore,
      limit: sort === 'relevance' ? limit : undefined,
    });
    const sorted = sortRepos(repos, sort, order);
    return sorted.slice(0, limit);
  }

  const { getTable, hasAnyEmbeddings } = await import('./storage.js');
  const table = await getTable();
  const count = await table.countRows();

  if (count === 0) return [];

  const hasEmbeddings = await hasAnyEmbeddings(count);
  const initialCandidateLimit = Math.min(count, Math.max(limit * 5, 50));
  const shouldProgressivelyExpand = hasStructuredFilters && sort === 'relevance';
  const initialCandidateLimitForMode = sort === 'relevance' ? initialCandidateLimit : count;

  const finalizeResults = (repos: Repo[]): Repo[] => {
    const filtered = applyFilters(repos, options);
    const sorted = sortRepos(filtered, sort, order);
    return sorted.slice(0, limit);
  };

  let fetchCandidates: (candidateLimit: number) => Promise<Repo[]>;

  if (hasEmbeddings) {
    const { generateEmbedding } = await import('./embeddings.js');
    const vector = await generateEmbedding(trimmed);
    fetchCandidates = async (candidateLimit: number) => {
      const [vectorResults, ftsResults] = await Promise.all([
        searchVector(vector, candidateLimit),
        searchFTS(trimmed, candidateLimit),
      ]);
      return dedup([...vectorResults, ...ftsResults]);
    };
  } else {
    fetchCandidates = async (candidateLimit: number) => searchFTS(trimmed, candidateLimit);
  }

  let candidateLimit = initialCandidateLimitForMode;

  while (true) {
    const results = await fetchCandidates(candidateLimit);
    const finalResults = finalizeResults(results);

    if (!shouldProgressivelyExpand || finalResults.length >= limit || candidateLimit >= count) {
      return finalResults;
    }

    candidateLimit = Math.min(count, candidateLimit * 2);
  }
}
