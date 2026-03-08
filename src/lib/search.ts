import { Repo, listRepos, searchVector, searchFTS } from './storage.js';

export interface SearchFilters {
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
}

function dedup(repos: Repo[]): Repo[] {
  const seen = new Set<string>();
  return repos.filter(r => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });
}

function applyFilters(repos: Repo[], filters: SearchFilters): Repo[] {
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

export async function hybridSearch(query: string, limit = 20, filters: SearchFilters = {}): Promise<Repo[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return listRepos({ ...filters, limit });
  }

  const { getTable, getReposWithoutEmbedding } = await import('./storage.js');
  const table = await getTable();
  const count = await table.countRows();

  if (count === 0) return [];

  // Check if any embeddings exist by checking repos without embeddings
  const withoutEmbedding = await getReposWithoutEmbedding();
  const hasEmbeddings = withoutEmbedding.length < count;
  const candidateLimit = Math.max(limit * 5, 50);

  if (hasEmbeddings) {
    const { generateEmbedding } = await import('./embeddings.js');
    const vector = await generateEmbedding(trimmed);
    const [vectorResults, ftsResults] = await Promise.all([
      searchVector(vector, candidateLimit),
      searchFTS(trimmed, candidateLimit),
    ]);
    return applyFilters(dedup([...vectorResults, ...ftsResults]), filters).slice(0, limit);
  } else {
    const results = await searchFTS(trimmed, candidateLimit);
    return applyFilters(results, filters).slice(0, limit);
  }
}
