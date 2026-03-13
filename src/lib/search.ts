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

  const { getTable, hasAnyEmbeddings, countRepos } = await import('./storage.js');
  const table = await getTable();
  const count = await table.countRows();

  if (count === 0) return [];

  const filteredCount = hasStructuredFilters ? await countRepos(options) : count;
  if (filteredCount === 0) return [];

  const hasEmbeddings = await hasAnyEmbeddings(count);
  const initialCandidateLimit = Math.min(filteredCount, Math.max(limit * 5, 50));
  const shouldProgressivelyExpand = hasStructuredFilters && sort === 'relevance';
  const initialCandidateLimitForMode = sort === 'relevance' ? initialCandidateLimit : filteredCount;

  const finalizeResults = (repos: Repo[]): Repo[] => {
    const sorted = sortRepos(repos, sort, order);
    return sorted.slice(0, limit);
  };

  let fetchCandidates: (candidateLimit: number) => Promise<Repo[]>;

  if (hasEmbeddings) {
    const { generateEmbedding } = await import('./embeddings.js');
    const vector = await generateEmbedding(trimmed);
    fetchCandidates = async (candidateLimit: number) => {
      const [vectorResults, ftsResults] = await Promise.all([
        searchVector(vector, candidateLimit, options),
        searchFTS(trimmed, candidateLimit, options),
      ]);
      return dedup([...vectorResults, ...ftsResults]);
    };
  } else {
    fetchCandidates = async (candidateLimit: number) => searchFTS(trimmed, candidateLimit, options);
  }

  let candidateLimit = initialCandidateLimitForMode;

  while (true) {
    const results = await fetchCandidates(candidateLimit);
    const finalResults = finalizeResults(results);

    if (!shouldProgressivelyExpand || finalResults.length >= limit || candidateLimit >= filteredCount) {
      return finalResults;
    }

    candidateLimit = Math.min(filteredCount, candidateLimit * 2);
  }
}
