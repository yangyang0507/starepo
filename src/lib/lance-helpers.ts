import * as lancedb from '@lancedb/lancedb';

import { Repo } from './storage.js';

// ── Type-safe LanceDB wrappers ────────────────────────────────────────────────
// Thin wrappers so business logic stays free of query-builder chaining and
// the FTS column set lives in exactly one place.

// topics_text holds the normalized space-joined topics; indexing it instead of
// the raw JSON `topics` string keeps the tokenizer free of quotes and brackets.
const FTS_COLUMNS = ['name', 'full_name', 'description', 'topics_text', 'language'] as const;

export async function mergeInsert(
  table: lancedb.Table,
  on: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  await table.mergeInsert(on)
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute(rows);
}

export async function updateRows(
  table: lancedb.Table,
  // Narrower than lancedb's IntoSql; covers every value this project writes.
  values: Record<string, string | number | boolean | null | number[]>,
  where: string,
): Promise<void> {
  await table.update({ values, where });
}

export async function deleteRows(table: lancedb.Table, where: string): Promise<void> {
  await table.delete(where);
}

export async function createFTSIndex(table: lancedb.Table): Promise<void> {
  // LanceDB 0.38+ creates one FTS index per column; duplicate creation is a
  // no-op, so this is safe to call on databases that already have indexes.
  for (const column of FTS_COLUMNS) {
    await table.createIndex(column, { config: lancedb.Index.fts() });
  }
}

export async function vectorSearchQuery(
  table: lancedb.Table,
  vector: number[],
  columns: readonly string[],
  where: string | undefined,
  limit: number,
): Promise<Repo[]> {
  let query = table.vectorSearch(vector);
  if (where) query = query.where(where);
  return await query.select([...columns]).limit(limit).toArray() as unknown as Repo[];
}

export async function ftsSearchQuery(
  table: lancedb.Table,
  query: string,
  columns: readonly string[],
  where: string | undefined,
  limit: number,
): Promise<Repo[]> {
  // `table.search(string)` routes to FTS at runtime when the query is text;
  // the typed union needs a narrowing cast to the plain query builder.
  let q = table.search(query) as lancedb.Query;
  if (where) q = q.where(where);
  return await q.select([...columns]).limit(limit).toArray() as unknown as Repo[];
}

export async function queryToArray<T>(query: lancedb.Query): Promise<T[]> {
  return await query.toArray() as unknown as T[];
}

export async function queryWhereToArray<T>(
  table: lancedb.Table,
  where: string,
): Promise<T[]> {
  return await table.query().where(where).toArray() as unknown as T[];
}

export async function querySelectToArray<T>(
  table: lancedb.Table,
  columns: string[],
  where?: string,
): Promise<T[]> {
  let q = table.query().select(columns);
  if (where) q = q.where(where);
  return await q.toArray() as unknown as T[];
}
