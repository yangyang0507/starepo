import { existsSync, readdirSync } from 'fs';
import { getDBPath, getMeta, getToken } from '../lib/config.js';
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  getEmbeddingStatus,
  type EmbeddingMetadataStatus,
} from '../lib/embeddings.js';
import { getStats } from '../lib/storage.js';
import { staleSyncHint } from '../lib/format.js';
import { formatBar, formatRelativeTime, style } from '../lib/term.js';
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

function formatTimestamp(value: string | null, now: number): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const relative = style.gray(`(${formatRelativeTime(value, now)})`);
  const absolute = date.toLocaleString();
  return `${staleSyncHint(value, now) ? style.yellow(absolute) : absolute} ${relative}`;
}

const LABEL_WIDTH = 14;

export function formatStatus(report: StatusReport, now = Date.now()): string {
  const field = (label: string, value: string) => `${style.gray(label.padEnd(LABEL_WIDTH))}${value}`;
  const detail = (text: string) => `${' '.repeat(LABEL_WIDTH)}${text}`;

  const lines = [
    `${style.bold(`starepo ${report.version}`)} ${style.gray(`(Node ${report.node})`)}`,
    '',
    field('Auth', report.authenticated ? style.green('yes') : style.yellow('no (run `starepo auth`)')),
    field('Database', report.database.path),
  ];
  if (!report.database.ok) lines.push(detail(style.red(`error: ${report.database.error}`)));

  lines.push(
    field('Schema', report.schemaVersion ? `v${report.schemaVersion}` : style.gray('unknown')),
    field('Stars', report.stars === null ? style.gray('unavailable') : String(report.stars)),
    field('Last sync', formatTimestamp(report.lastSync, now)),
  );

  if (report.embeddings) {
    const { embedded, total, missing, model, version, status } = report.embeddings;
    const complete = missing === 0;
    const paint = complete ? style.green : style.yellow;
    const coverage = total > 0 ? `${paint(formatBar(embedded / total, 10))} ` : '';
    const missingLabel = complete ? style.gray('(0 missing)') : style.yellow(`(${missing} missing)`);
    lines.push(field('Embeddings', `${coverage}${embedded}/${total} ready ${missingLabel}`));
    const modelLabel = model && version ? `${model}@${version}` : 'none';
    const statusLabel = status === 'current' ? style.green(status) : status === 'outdated' ? style.yellow(status) : status;
    lines.push(field('Model', `${modelLabel} (${statusLabel})`));
    if (status === 'outdated') {
      lines.push(detail(style.gray(`run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}`)));
    }
  } else {
    lines.push(field('Embeddings', style.gray('unavailable')), field('Model', style.gray('unavailable')));
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
