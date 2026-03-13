import * as lancedb from '@lancedb/lancedb';
import { Schema, Field, Utf8, Int32, Int64, Float32, FixedSizeList } from 'apache-arrow';
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
  topics_text?: string;
  stars_count: number;
  forks_count: number;
  starred_at: string;
  updated_at: string;
  starred_at_ts?: number;
  updated_at_ts?: number;
  vector?: number[];    // embedding, zeros if not yet generated
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
const BASE_SCHEMA_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 3;

let _db: lancedb.Connection | null = null;
let _table: lancedb.Table | null = null;
let _hasEmbeddings: boolean | null = null;
let _ftsIndexReady = false;
let _schemaReady = false;
const SEARCH_RESULT_COLUMNS = [
  'id',
  'full_name',
  'name',
  'description',
  'html_url',
  'homepage',
  'language',
  'topics',
  'topics_text',
  'stars_count',
  'forks_count',
  'starred_at',
  'updated_at',
  'starred_at_ts',
  'updated_at_ts',
] as const;
const SEARCH_RESULT_COLUMNS_WITH_DISTANCE = [...SEARCH_RESULT_COLUMNS, '_distance'] as const;

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function toTopicsText(topics: string[]): string {
  return topics
    .map((topic) => topic.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function topicsTextFromSerialized(value: string): string {
  try {
    return toTopicsText(JSON.parse(value) as string[]);
  } catch {
    return value.trim().toLowerCase();
  }
}

function toEpochMillis(value: string): number {
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 0 : millis;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return undefined;
}

function normalizeRepo(repo: Repo): Repo {
  return {
    ...repo,
    topics_text: repo.topics_text ?? topicsTextFromSerialized(repo.topics),
    starred_at_ts: toOptionalNumber(repo.starred_at_ts),
    updated_at_ts: toOptionalNumber(repo.updated_at_ts),
  };
}

function normalizeRepos(repos: Repo[]): Repo[] {
  return repos.map(normalizeRepo);
}

function buildFullNameWhereClause(fullNames: string[]): string | undefined {
  if (fullNames.length === 0) return undefined;
  return fullNames
    .map((fullName) => `full_name = '${escapeSqlString(fullName)}'`)
    .join(' OR ');
}

export interface RepoQueryFilters {
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
}

function buildRepoWhereClause(filters: RepoQueryFilters): string | undefined {
  const conditions: string[] = [];
  if (filters.language) conditions.push(`lower(language) = lower('${escapeSqlString(filters.language)}')`);
  if (filters.topic) conditions.push(`topics_text LIKE '%${escapeSqlString(filters.topic.toLowerCase())}%'`);
  if (filters.starredAfter) {
    conditions.push(`starred_at_ts >= ${toEpochMillis(filters.starredAfter)}`);
  }
  if (filters.starredBefore) {
    conditions.push(`starred_at_ts <= ${toEpochMillis(filters.starredBefore)}`);
  }
  return conditions.length > 0 ? conditions.join(' AND ') : undefined;
}

function matchesRepoFilters(repo: Repo, filters: RepoQueryFilters): boolean {
  if (filters.language && repo.language.toLowerCase() !== filters.language.toLowerCase()) {
    return false;
  }
  if (filters.topic) {
    const topicsText = (repo.topics_text ?? topicsTextFromSerialized(repo.topics)).toLowerCase();
    if (!topicsText.includes(filters.topic.toLowerCase())) return false;
  }
  if (filters.starredAfter) {
    const after = toEpochMillis(filters.starredAfter);
    const starredAtTs = repo.starred_at_ts ?? toEpochMillis(repo.starred_at);
    if (starredAtTs < after) return false;
  }
  if (filters.starredBefore) {
    const before = toEpochMillis(filters.starredBefore);
    const starredAtTs = repo.starred_at_ts ?? toEpochMillis(repo.starred_at);
    if (starredAtTs > before) return false;
  }
  return true;
}

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

async function ensureSchema(table: lancedb.Table): Promise<void> {
  if (_schemaReady) return;

  const storedVersion = Number.parseInt(getMeta('schema_version') ?? `${BASE_SCHEMA_VERSION}`, 10);
  let version = Number.isNaN(storedVersion) ? BASE_SCHEMA_VERSION : storedVersion;

  if (version < 2) {
    for (const column of [
      { name: 'starred_at_ts', valueSql: '0' },
      { name: 'updated_at_ts', valueSql: '0' },
    ]) {
      try {
        await table.addColumns([column]);
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('already exists'))) {
          throw err;
        }
      }
    }

    const rowsNeedingBackfill = await table.query()
      .where('starred_at_ts = 0 OR updated_at_ts = 0')
      .select(['full_name', 'starred_at', 'updated_at', 'starred_at_ts', 'updated_at_ts'])
      .toArray() as Array<Pick<Repo, 'full_name' | 'starred_at' | 'updated_at' | 'starred_at_ts' | 'updated_at_ts'>>;

    if (rowsNeedingBackfill.length > 0) {
      process.stderr.write(`Migrating starepo schema v2 (${rowsNeedingBackfill.length} rows)...\n`);
    }
    for (const row of rowsNeedingBackfill) {
      const starredAtTs = row.starred_at_ts && row.starred_at_ts > 0 ? row.starred_at_ts : toEpochMillis(row.starred_at);
      const updatedAtTs = row.updated_at_ts && row.updated_at_ts > 0 ? row.updated_at_ts : toEpochMillis(row.updated_at);
      const escaped = escapeSqlString(row.full_name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (table.update as any)({
        values: { starred_at_ts: starredAtTs, updated_at_ts: updatedAtTs },
        where: `full_name = '${escaped}'`,
      });
    }
    if (rowsNeedingBackfill.length > 0) {
      process.stderr.write('Schema v2 migration complete.\n');
    }

    version = 2;
    setMeta('schema_version', '2');
  }

  if (version < 3) {
    try {
      await table.addColumns([{ name: 'topics_text', valueSql: "''" }]);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('already exists'))) {
        throw err;
      }
    }

    const rowsNeedingBackfill = await table.query()
      .where("topics_text = '' AND topics != '[]'")
      .select(['full_name', 'topics', 'topics_text'])
      .toArray() as Array<Pick<Repo, 'full_name' | 'topics' | 'topics_text'>>;

    if (rowsNeedingBackfill.length > 0) {
      process.stderr.write(`Migrating starepo schema v3 (${rowsNeedingBackfill.length} rows)...\n`);
    }
    for (const row of rowsNeedingBackfill) {
      const topicsText = row.topics_text?.trim() ? row.topics_text : topicsTextFromSerialized(row.topics);
      const escaped = escapeSqlString(row.full_name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (table.update as any)({
        values: { topics_text: topicsText },
        where: `full_name = '${escaped}'`,
      });
    }
    if (rowsNeedingBackfill.length > 0) {
      process.stderr.write('Schema v3 migration complete.\n');
    }

    version = 3;
    setMeta('schema_version', '3');
  }

  if (version < CURRENT_SCHEMA_VERSION) {
    setMeta('schema_version', String(CURRENT_SCHEMA_VERSION));
  }
  _schemaReady = true;
}

export async function getTable(): Promise<lancedb.Table> {
  if (_table) {
    await ensureSchema(_table);
    return _table;
  }

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
      new Field('topics_text', new Utf8()),
      new Field('stars_count', new Int32()),
      new Field('forks_count', new Int32()),
      new Field('starred_at', new Utf8()),
      new Field('updated_at', new Utf8()),
      new Field('starred_at_ts', new Int64()),
      new Field('updated_at_ts', new Int64()),
      new Field('vector', new FixedSizeList(EMBEDDING_DIM, new Field('item', new Float32()))),
    ]);
    _table = await db.createEmptyTable(TABLE_NAME, schema, { existOk: true });
    setMeta('schema_version', String(CURRENT_SCHEMA_VERSION));
  } else {
    _table = await db.openTable(TABLE_NAME);
  }

  await ensureSchema(_table);
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
    topics_text: toTopicsText(r.topics),
    stars_count: r.stars_count,
    forks_count: r.forks_count,
    starred_at: r.starred_at,
    updated_at: r.updated_at,
    starred_at_ts: toEpochMillis(r.starred_at),
    updated_at_ts: toEpochMillis(r.updated_at),
    vector: r.vector ?? new Array(EMBEDDING_DIM).fill(0),
  };
}

async function getExistingVectors(fullNames: string[]): Promise<Map<string, number[]>> {
  if (fullNames.length === 0) return new Map();
  const table = await getTable();
  const vectors = new Map<string, number[]>();

  const chunkSize = 200;
  for (let i = 0; i < fullNames.length; i += chunkSize) {
    const chunk = fullNames.slice(i, i + chunkSize);
    const where = buildFullNameWhereClause(chunk);
    if (!where) continue;

    const existing = await table.query()
      .where(where)
      .select(['full_name', 'vector'])
      .toArray() as Array<Pick<Repo, 'full_name' | 'vector'>>;

    for (const repo of existing) {
      if (!repo.vector) continue;
      const vector = Array.isArray(repo.vector)
        ? repo.vector
        : Array.from(repo.vector as unknown as ArrayLike<number>);
      if (vector.every(v => v === 0)) continue;
      vectors.set(repo.full_name, vector);
    }
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
  const escaped = escapeSqlString(fullName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (table.update as any)({
    values: { vector },
    where: `full_name = '${escaped}'`,
  });
  setHasEmbeddings(true);
}

export async function searchVector(vector: number[], limit = 20, filters: RepoQueryFilters = {}): Promise<Repo[]> {
  const table = await getTable();
  let query = table.vectorSearch(vector) as lancedb.VectorQuery;
  const where = buildRepoWhereClause(filters);
  if (where) query = query.where(where) as lancedb.VectorQuery;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await (query as any)
    .select([...SEARCH_RESULT_COLUMNS_WITH_DISTANCE])
    .limit(limit)
    .toArray();
  return normalizeRepos(results as unknown as Repo[]);
}

export async function searchFTS(query: string, limit = 20, filters: RepoQueryFilters = {}): Promise<Repo[]> {
  const table = await getTable();
  await ensureFTSIndex(table);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let searchQuery = table.search(query) as any;
    const where = buildRepoWhereClause(filters);
    if (where) searchQuery = searchQuery.where(where);
    const results = await searchQuery
      .select([...SEARCH_RESULT_COLUMNS_WITH_DISTANCE])
      .limit(limit)
      .toArray();
    return normalizeRepos(results as unknown as Repo[]);
  } catch {
    const pattern = query.toLowerCase();
    let fallbackQuery = table.query();
    const where = buildRepoWhereClause(filters);
    if (where) fallbackQuery = fallbackQuery.where(where);
    const results = normalizeRepos(await fallbackQuery.toArray() as unknown as Repo[]);
    return results
      .filter((repo) => matchesRepoFilters(repo, filters))
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

  let q = table.query();
  const where = buildRepoWhereClause({ language, topic, starredAfter, starredBefore });
  if (where) q = q.where(where);
  if (limit !== undefined) q = q.limit(limit);
  return normalizeRepos((await q.toArray()) as unknown as Repo[]);
}

export async function countRepos(filters: RepoQueryFilters = {}): Promise<number> {
  const table = await getTable();
  const where = buildRepoWhereClause(filters);
  return table.countRows(where);
}

export async function deleteReposMissingFromFullNames(fullNames: string[]): Promise<number> {
  const table = await getTable();
  const currentNames = new Set(fullNames);
  const existing = await table.query().select(['full_name']).toArray() as Array<Pick<Repo, 'full_name'>>;
  const staleNames = existing
    .map((repo) => repo.full_name)
    .filter((fullName) => !currentNames.has(fullName));

  if (staleNames.length === 0) return 0;

  const chunkSize = 200;
  for (let i = 0; i < staleNames.length; i += chunkSize) {
    const chunk = staleNames.slice(i, i + chunkSize);
    const where = buildFullNameWhereClause(chunk);
    if (!where) continue;
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
  const escaped = escapeSqlString(fullName);
  const results = await table.query().where(`full_name = '${escaped}'`).limit(1).toArray();
  return results[0] ? normalizeRepo(results[0] as unknown as Repo) : null;
}

export async function getStats(): Promise<{ count: number; lastSync: string | null }> {
  const table = await getTable();
  const count = await table.countRows();
  return { count, lastSync: getMeta('last_sync') };
}

export async function getReposWithoutEmbedding(): Promise<Repo[]> {
  const table = await getTable();
  const results = normalizeRepos(await table.query().toArray() as unknown as Repo[]);
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
  const hasEmbeddings = withoutEmbedding.length < count;
  setHasEmbeddings(hasEmbeddings);
  return hasEmbeddings;
}
