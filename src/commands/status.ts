import { existsSync, readdirSync } from 'fs';
import { getDBPath, getMeta, getToken } from '../lib/config.js';
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  getEmbeddingStatus,
  type EmbeddingMetadataStatus,
} from '../lib/embeddings.js';
import { getStats } from '../lib/storage.js';
import { formatBar, style } from '../lib/term.js';
import { VERSION } from '../lib/version.js';

export interface StatusDatabase {
  path: string;
  ok: boolean;
  error?: string;
}

export interface StatusEmbeddings {
  embedded: number;
  total: number;
  missing: number;
  model: string | null;
  version: string | null;
  status: EmbeddingMetadataStatus;
}

export interface StatusReport {
  version: string;
  node: string;
  authenticated: boolean;
  database: StatusDatabase;
  schemaVersion: string | null;
  stars: number | null;
  lastSync: string | null;
  embeddings: StatusEmbeddings | null;
}

function hasLocalDatabase(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  try {
    return readdirSync(dbPath).some((name) => name !== '.' && name !== '..' && !name.startsWith('.'));
  } catch {
    return false;
  }
}

function embeddingMetadataStatus(model: string | null, version: string | null): EmbeddingMetadataStatus {
  if (!model || !version) return 'missing';
  if (model === EMBEDDING_MODEL && version === EMBEDDING_VERSION) return 'current';
  return 'outdated';
}

function embeddingsFromMeta(): StatusEmbeddings {
  const model = getMeta('embedding_model');
  const version = getMeta('embedding_version');
  return {
    embedded: 0,
    total: 0,
    missing: 0,
    model,
    version,
    status: embeddingMetadataStatus(model, version),
  };
}

export async function collectStatus(): Promise<StatusReport> {
  const databasePath = getDBPath();
  const report: StatusReport = {
    version: VERSION,
    node: process.version,
    authenticated: getToken() !== null,
    database: { path: databasePath, ok: true },
    schemaVersion: getMeta('schema_version'),
    stars: 0,
    lastSync: getMeta('last_sync'),
    embeddings: embeddingsFromMeta(),
  };

  if (!hasLocalDatabase(databasePath)) {
    return report;
  }

  try {
    const [{ count, lastSync }, embeddingStatus] = await Promise.all([
      getStats(),
      getEmbeddingStatus(),
    ]);
    report.stars = count;
    report.lastSync = lastSync;
    report.schemaVersion = getMeta('schema_version');
    report.embeddings = {
      embedded: embeddingStatus.embeddedRepos,
      total: embeddingStatus.totalRepos,
      missing: embeddingStatus.missingRepos,
      model: embeddingStatus.metadata.model,
      version: embeddingStatus.metadata.version,
      status: embeddingStatus.metadataStatus,
    };
  } catch (err) {
    report.database.ok = false;
    report.database.error = err instanceof Error ? err.message : String(err);
    report.stars = null;
    report.embeddings = null;
  }

  return report;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function formatStatus(report: StatusReport): string {
  const auth = report.authenticated ? style.green('yes') : style.yellow('no (run `starepo auth`)');
  const lines = [
    `starepo ${report.version} (Node ${report.node})`,
    '',
    `Auth          ${auth}`,
    `Database      ${report.database.path}`,
  ];

  if (!report.database.ok) {
    lines.push(`               ${style.red(`error: ${report.database.error}`)}`);
  }

  lines.push(`Schema        ${report.schemaVersion ? `v${report.schemaVersion}` : 'unknown'}`);
  lines.push(`Stars         ${report.stars === null ? 'unavailable' : String(report.stars)}`);
  lines.push(`Last sync     ${formatTimestamp(report.lastSync)}`);

  if (report.embeddings) {
    const { embedded, total, missing, model, version, status } = report.embeddings;
    const coverage = total > 0 ? `${formatBar(embedded / total, 10)} ` : '';
    lines.push(`Embeddings    ${coverage}${embedded}/${total} ready (${missing} missing)`);
    const modelLabel = model && version ? `${model}@${version}` : 'none';
    const statusLabel = status === 'current' ? style.green(status) : status === 'outdated' ? style.yellow(status) : status;
    lines.push(`Model         ${modelLabel} (${statusLabel})`);
    if (status === 'outdated') {
      lines.push(`               run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}`);
    }
  } else {
    lines.push('Embeddings    unavailable');
    lines.push('Model         unavailable');
  }

  return lines.join('\n');
}

export async function runStatus(options: { json?: boolean } = {}): Promise<void> {
  const report = await collectStatus();
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(formatStatus(report));
}
