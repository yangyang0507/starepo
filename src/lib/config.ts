import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const APP_NAME = 'starepo';

export function getConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? '~', '.config');
  const dir = join(base, APP_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDataDir(): string {
  const base = process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? '~', '.local', 'share');
  const dir = join(base, APP_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getAuthFilePath(): string {
  return join(getConfigDir(), 'auth.json');
}

export function getMetaFilePath(): string {
  return join(getConfigDir(), 'meta.json');
}

export function getDBPath(): string {
  return join(getDataDir(), 'lancedb');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

interface AuthData {
  token: string;
  createdAt: string;
}

export function getToken(): string | null {
  const path = getAuthFilePath();
  if (!existsSync(path)) return null;
  try {
    const data: AuthData = JSON.parse(readFileSync(path, 'utf-8'));
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  const data: AuthData = { token, createdAt: new Date().toISOString() };
  writeFileSync(getAuthFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function clearToken(): void {
  writeFileSync(getAuthFilePath(), '{}', 'utf-8');
}

// ── Meta (last_sync, etc.) ────────────────────────────────────────────────────

type MetaData = Record<string, string>;

function readMeta(): MetaData {
  const path = getMetaFilePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as MetaData;
  } catch {
    return {};
  }
}

function writeMeta(data: MetaData): void {
  writeFileSync(getMetaFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function getMeta(key: string): string | null {
  return readMeta()[key] ?? null;
}

export function setMeta(key: string, value: string): void {
  const data = readMeta();
  data[key] = value;
  writeMeta(data);
}
