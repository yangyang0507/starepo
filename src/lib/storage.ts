import * as lancedb from '@lancedb/lancedb';
import { Schema, Field, Utf8, Int32, Float32, FixedSizeList } from 'apache-arrow';
import { getDBPath } from './config.js';

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

export async function upsertRepos(repos: RepoInput[]): Promise<void> {
  const table = await getTable();
  const rows = repos.map(toRow);

  await (table
    .mergeInsert('full_name') as lancedb.MergeInsertBuilder)
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute(rows);
}

export async function updateEmbedding(fullName: string, vector: number[]): Promise<void> {
  const table = await getTable();
  const escaped = fullName.replace(/'/g, "''");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (table.update as any)({
    values: { vector },
    where: `full_name = '${escaped}'`,
  });
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

  // Create FTS index if not exists (LanceDB requires INVERTED index for full-text search)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (table as any).createIndex('fts_idx', {
      config: {
        type: 'INVERTED',
        columns: ['name', 'full_name', 'description', 'topics', 'language'],
      },
    });
  } catch (err) {
    // Index may already exist, ignore
    if (!(err instanceof Error && err.message.includes('already exists'))) {
      // If FTS not available, fallback to filter-based search
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

  const results = await table.search(query).limit(limit).toArray();
  return results as unknown as Repo[];
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

export async function getRepoByName(fullName: string): Promise<Repo | null> {
  const table = await getTable();
  const escaped = fullName.replace(/'/g, "''");
  const results = await table.query().where(`full_name = '${escaped}'`).limit(1).toArray();
  return (results[0] as unknown as Repo) ?? null;
}

export async function getStats(): Promise<{ count: number; lastSync: string | null }> {
  const { getMeta } = await import('./config.js');
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
