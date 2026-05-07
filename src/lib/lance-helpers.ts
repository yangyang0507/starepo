import * as lancedb from '@lancedb/lancedb';
import { Repo } from './storage.js';

// ── Type-safe LanceDB wrappers ────────────────────────────────────────────────
// LanceDB's TS definitions are incomplete for several APIs. These wrappers
// centralise the `as any` / `as unknown` casts so business logic stays clean.

export async function mergeInsert(
  table: lancedb.Table,
  on: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  await (table.mergeInsert(on) as lancedb.MergeInsertBuilder)
    .whenMatchedUpdateAll()
    .whenNotMatchedInsertAll()
    .execute(rows);
}

export async function updateRows(
  table: lancedb.Table,
  values: Record<string, unknown>,
  where: string,
): Promise<void> {
  await (table.update as unknown as (opts: { values: Record<string, unknown>; where: string }) => Promise<void>)({
    values,
    where,
  });
}

export async function deleteRows(table: lancedb.Table, where: string): Promise<void> {
  await (table as unknown as { delete: (where: string) => Promise<void> }).delete(where);
}

export async function createFTSIndex(
  table: lancedb.Table,
  name: string,
  columns: string[],
): Promise<void> {
  await (table as unknown as {
    createIndex: (name: string, opts: { config: { type: string; columns: string[] } }) => Promise<void>;
  }).createIndex(name, {
    config: { type: 'INVERTED', columns },
  });
}

export async function vectorSearchQuery(
  table: lancedb.Table,
  vector: number[],
  columns: readonly string[],
  where: string | undefined,
  limit: number,
): Promise<Repo[]> {
  let query = table.vectorSearch(vector) as lancedb.VectorQuery & {
    where: (w: string) => lancedb.VectorQuery;
    select: (c: string[]) => { limit: (n: number) => { toArray: () => Promise<Repo[]> } };
  };
  if (where) query = query.where(where);
  return await query.select([...columns]).limit(limit).toArray();
}

export async function ftsSearchQuery(
  table: lancedb.Table,
  query: string,
  columns: readonly string[],
  where: string | undefined,
  limit: number,
): Promise<Repo[]> {
  let q = table.search(query) as {
    where: (w: string) => typeof q;
    select: (c: string[]) => { limit: (n: number) => { toArray: () => Promise<Repo[]> } };
  };
  if (where) q = q.where(where);
  return await q.select([...columns]).limit(limit).toArray();
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
