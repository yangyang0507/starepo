import * as lancedb from '@lancedb/lancedb';
import { Schema, Field, Utf8, Int32, Float32, FixedSizeList } from 'apache-arrow';
import { getDBPath, getMeta, setMeta } from './config.js';

export interface Repo {
  id: number;
  full_name: string;
  name: string;
  description: string;
  html_url: string;
  homepage: string;
  language: string;
  topics: string;       // JSON array string
  stars_count: number;
  forks_count: number;
  starred_at: string;
  updated_at: string;
  vector: number[];     // embedding, zeros if not yet generated
}

// What github.ts hands us (topics is string[], vector optional)
export interface RepoInput {
  id: number;
  full_name: string;
  name: string;
  description: string;
  html_url: string;
  homepage: string;
  language: string;
  topics: string[];
  stars_count: number;
  forks_count: number;
  starred_at: string;
  updated_at: string;
  vector?: number[];
}

const TABLE_NAME = 'repos';
const EMBEDDING_DIM = 1024; // Xenova/bge-m3

let _db: lancedb.Connection | null = null;
let _table: lancedb.Table | null = null;
let _hasEmbeddings: boolean | null = null;
let _ftsIndexReady = false;

export function setHasEmbeddings(hasEmbeddings: boolean): void {
  _hasEmbeddings = hasEmbeddings;
  setMeta('has_embeddings', String(hasEmbeddings));
}

async function ensureFTSIndex(table: lancedb.Table): Promise<void> {
  if (_ftsIndexReady) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (table as any).createIndex('fts_idx', {
      config: {
        type: 'INVERTED',
        columns: ['name', 'full_name', 'description', 'topics', 'language'],
      },
    });
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('already exists'))) {
      return;
    }
  }

  _ftsIndexReady = true;
}

async function getDB(): Promise<lancedb.Connection> {
  if (!_db) _db = await lancedb.connect(getDBPath());
  return _db;
}

export async function getTable(): Promise<lancedb.Table> {
  if (_table) return _table;

  const db = await getDB();
  const names = await db.tableNames();

  if (!names.includes(TABLE_NAME)) {
    const schema = new Schema([
      new Field('id', new Int32()),
      new Field('full_name', new Utf8()),
      new Field('name', new Utf8()),
      new Field('description', new Utf8()),
      new Field('html_url', new Utf8()),
      new Field('homepage', new Utf8()),
      new Field('language', new Utf8()),
      new Field('topics', new Utf8()),
      new Field('stars_count', new Int32()),
      new Field('forks_count', new Int32()),
      new Field('starred_at', new Utf8()),
      new Field('updated_at', new Utf8()),
      new Field('vector', new FixedSizeList(EMBEDDING_DIM, new Field('item', new Float32()))),
    ]);
    _table = await db.createEmptyTable(TABLE_NAME, schema, { existOk: true });
  } else {
    _table = await db.openTable(TABLE_NAME);
  }

  return _table;
}

function toRow(r: RepoInput): Record<string, unknown> {
  return {
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    description: r.description,
    html_url: r.html_url,
    homepage: r.homepage,
    language: r.language,
    topics: JSON.stringify(r.topics),
    stars_count: r.stars_count,
    forks_count: r.forks_count,
    starred_at: r.starred_at,
    updated_at: r.updated_at,
    vector: r.vector ?? new Array(EMBEDDING_DIM).fill(0),
  };
}

async function getExistingVectors(fullNames: string[]): Promise<Map<string, number[]>> {
  if (fullNames.length === 0) return new Map();

  if (fullNames.length <= 50) {
    const repos = await Promise.all(fullNames.map((fullName) => getRepoByName(fullName)));
    const vectors = new Map<string, number[]>();

    for (const repo of repos) {
      if (!repo?.vector) continue;
      const vector = Array.isArray(repo.vector)
        ? repo.vector
        : Array.from(repo.vector as unknown as ArrayLike<number>);
      if (vector.every(v => v === 0)) continue;
      vectors.set(repo.full_name, vector);
    }

    return vectors;
  }

  const wanted = new Set(fullNames);
  const table = await getTable();
  const existing = await table.query().toArray() as unknown as Repo[];
  const vectors = new Map<string, number[]>();

  for (const repo of existing) {
    if (!wanted.has(repo.full_name) || !repo.vector) continue;
    const vector = Array.isArray(repo.vector)
      ? repo.vector
      : Array.from(repo.vector as unknown as ArrayLike<number>);
    if (vector.every(v => v === 0)) continue;
    vectors.set(repo.full_name, vector);
  }

  return vectors;
}

export async function upsertRepos(repos: RepoInput[]): Promise<void> {
  const table = await getTable();
  const wasEmpty = await table.countRows() === 0;
  const reposWithoutVector = repos.filter((repo) => repo.vector === undefined).map((repo) => repo.full_name);
  const existingVectors = wasEmpty ? new Map<string, number[]>() : await getExistingVectors(reposWithoutVector);
  const rows = repos.map((repo) => toRow({
    ...repo,
    vector: repo.vector ?? existingVectors.get(repo.full_name),
  }));

  await (table
    .mergeInsert('full_name') as lancedb.MergeInsertBuilder)
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute(rows);

  if (repos.some((repo) => repo.vector?.some((value) => value !== 0))) {
    setHasEmbeddings(true);
  } else if (wasEmpty) {
    setHasEmbeddings(false);
  }
}

export async function updateEmbedding(fullName: string, vector: number[]): Promise<void> {
  const table = await getTable();
  const escaped = fullName.replace(/'/g, "''");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (table.update as any)({
    values: { vector },
    where: `full_name = '${escaped}'`,
  });
  setHasEmbeddings(true);
}

export async function searchVector(vector: number[], limit = 20): Promise<Repo[]> {
  const table = await getTable();
  const results = await (table.vectorSearch(vector) as lancedb.VectorQuery)
    .limit(limit)
    .toArray();
  return results as unknown as Repo[];
}

export async function searchFTS(query: string, limit = 20): Promise<Repo[]> {
  const table = await getTable();
  await ensureFTSIndex(table);
  try {
    const results = await table.search(query).limit(limit).toArray();
    return results as unknown as Repo[];
  } catch {
    const pattern = query.toLowerCase();
    const results = await table.query().toArray() as unknown as Repo[];
    return results
      .filter(r =>
        r.name.toLowerCase().includes(pattern) ||
        r.full_name.toLowerCase().includes(pattern) ||
        r.description.toLowerCase().includes(pattern) ||
        r.topics.toLowerCase().includes(pattern) ||
        r.language.toLowerCase().includes(pattern)
      )
      .slice(0, limit);
  }
}

export async function listRepos(options: {
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  limit?: number;
} = {}): Promise<Repo[]> {
  const { language, topic, starredAfter, starredBefore, limit } = options;
  const table = await getTable();

  const conditions: string[] = [];
  if (language) conditions.push(`lower(language) = lower('${language.replace(/'/g, "''")}')`);
  if (topic) conditions.push(`topics LIKE '%${topic.replace(/'/g, "''")}%'`);

  let q = table.query();
  if (conditions.length > 0) q = q.where(conditions.join(' AND '));
  const results = (await q.toArray()) as unknown as Repo[];
  const filtered = results.filter((repo) => {
    if (!starredAfter && !starredBefore) return true;
    const starredAt = repo.starred_at ? new Date(repo.starred_at).getTime() : NaN;
    if (Number.isNaN(starredAt)) return false;

    if (starredAfter) {
      const after = new Date(starredAfter).getTime();
      if (!Number.isNaN(after) && starredAt < after) return false;
    }
    if (starredBefore) {
      const before = new Date(starredBefore).getTime();
      if (!Number.isNaN(before) && starredAt > before) return false;
    }
    return true;
  });

  return limit !== undefined ? filtered.slice(0, limit) : filtered;
}

export async function deleteReposMissingFromFullNames(fullNames: string[]): Promise<number> {
  const table = await getTable();
  const currentNames = new Set(fullNames);
  const existing = await table.query().toArray() as unknown as Repo[];
  const staleNames = existing
    .map((repo) => repo.full_name)
    .filter((fullName) => !currentNames.has(fullName));

  if (staleNames.length === 0) return 0;

  const chunkSize = 200;
  for (let i = 0; i < staleNames.length; i += chunkSize) {
    const chunk = staleNames.slice(i, i + chunkSize);
    const where = chunk
      .map((fullName) => `full_name = '${fullName.replace(/'/g, "''")}'`)
      .join(' OR ');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (table as any).delete(where);
  }

  _ftsIndexReady = false;

  const remaining = await table.countRows();
  if (remaining === 0) setHasEmbeddings(false);

  return staleNames.length;
}

export async function getRepoByName(fullName: string): Promise<Repo | null> {
  const table = await getTable();
  const escaped = fullName.replace(/'/g, "''");
  const results = await table.query().where(`full_name = '${escaped}'`).limit(1).toArray();
  return (results[0] as unknown as Repo) ?? null;
}

export async function getStats(): Promise<{ count: number; lastSync: string | null }> {
  const table = await getTable();
  const count = await table.countRows();
  return { count, lastSync: getMeta('last_sync') };
}

export async function getReposWithoutEmbedding(): Promise<Repo[]> {
  const table = await getTable();
  const results = await table.query().toArray() as unknown as Repo[];
  return results.filter(r => {
    if (!r.vector) return true;
    // Convert Arrow FixedSizeList to array if needed
    const vec = Array.isArray(r.vector) ? r.vector : Array.from(r.vector as unknown as ArrayLike<number>);
    return vec.length === 0 || vec.every(v => v === 0);
  });
}

export async function hasAnyEmbeddings(totalCount?: number): Promise<boolean> {
  const count = totalCount ?? await (await getTable()).countRows();
  if (count === 0) {
    if (_hasEmbeddings === false) return false;
    setHasEmbeddings(false);
    return false;
  }

  if (_hasEmbeddings !== null) return _hasEmbeddings;

  const cached = getMeta('has_embeddings');
  if (cached === 'true' || cached === 'false') {
    _hasEmbeddings = cached === 'true';
    return _hasEmbeddings;
  }

  const withoutEmbedding = await getReposWithoutEmbedding();
  setHasEmbeddings(withoutEmbedding.length < count);
  return _hasEmbeddings;
}
