import { getDataDir } from './config.js';
import { setMeta, getMeta } from './config.js';
import { join } from 'path';
import { Repo } from './storage.js';

type FeatureExtractionPipeline = (
  text: string,
  options?: Record<string, unknown>
) => Promise<{ data: Float32Array }>;

let _pipeline: FeatureExtractionPipeline | null = null;
const EMBEDDING_CONCURRENCY = 3;
const EMBEDDING_WRITE_BATCH_SIZE = 25;
export const EMBEDDING_MODEL = 'Xenova/bge-m3';
export const EMBEDDING_VERSION = '1';

export interface EmbeddingMetadata {
  model: string | null;
  version: string | null;
}

export type EmbeddingMetadataStatus = 'current' | 'missing' | 'outdated';

export interface EmbeddingStatus {
  totalRepos: number;
  embeddedRepos: number;
  missingRepos: number;
  metadata: EmbeddingMetadata;
  metadataStatus: EmbeddingMetadataStatus;
}

export interface EmbeddingGenerationOptions {
  force?: boolean;
  onProgress?: (done: number, total: number) => void;
  generate?: (text: string) => Promise<number[]>;
}

export interface EmbeddingGenerationResult {
  totalRepos: number;
  processedRepos: number;
  skippedRepos: number;
  forced: boolean;
  metadataUpdated: boolean;
  metadataStatusBefore: EmbeddingMetadataStatus;
}

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;

  const { pipeline, env } = await import('@xenova/transformers');

  // Store model cache in XDG data dir (~/.local/share/starepo/models)
  // instead of node_modules, so it persists across installs and updates
  const modelCacheDir = join(getDataDir(), 'models');
  env.cacheDir = modelCacheDir;

  process.stderr.write('Loading embedding model (first-time download may take a while)...\n');
  _pipeline = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as unknown as FeatureExtractionPipeline;
  process.stderr.write('Embedding model ready.\n');
  return _pipeline;
}

export function getEmbeddingMetadata(): EmbeddingMetadata {
  return {
    model: getMeta('embedding_model'),
    version: getMeta('embedding_version'),
  };
}

export function setEmbeddingMetadata(): void {
  setMeta('embedding_model', EMBEDDING_MODEL);
  setMeta('embedding_version', EMBEDDING_VERSION);
}

function getEmbeddingMetadataStatus(metadata: EmbeddingMetadata): EmbeddingMetadataStatus {
  if (!metadata.model || !metadata.version) return 'missing';
  if (metadata.model === EMBEDDING_MODEL && metadata.version === EMBEDDING_VERSION) return 'current';
  return 'outdated';
}

export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const { getStats, countReposWithoutEmbedding } = await import('./storage.js');
  const { count } = await getStats();
  const metadata = getEmbeddingMetadata();
  if (count === 0) {
    return {
      totalRepos: 0,
      embeddedRepos: 0,
      missingRepos: 0,
      metadata,
      metadataStatus: getEmbeddingMetadataStatus(metadata),
    };
  }

  const missingRepos = await countReposWithoutEmbedding();
  return {
    totalRepos: count,
    embeddedRepos: count - missingRepos,
    missingRepos,
    metadata,
    metadataStatus: getEmbeddingMetadataStatus(metadata),
  };
}

export function repoToText(repo: Pick<Repo, 'name' | 'full_name' | 'description' | 'topics' | 'language'>): string {
  const topics = (() => {
    try { return (JSON.parse(repo.topics) as string[]).join(' '); }
    catch { return repo.topics; }
  })();
  return [repo.name, repo.full_name, repo.description, topics, repo.language]
    .filter(Boolean)
    .join(' ');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export async function generateAndStoreEmbeddings(
  options: EmbeddingGenerationOptions = {}
): Promise<EmbeddingGenerationResult> {
  const { force = false, onProgress, generate = generateEmbedding } = options;
  const { getReposWithoutEmbedding, getReposForEmbedding, updateEmbeddingsBatch, setHasEmbeddings, getTable } = await import('./storage.js');
  const status = await getEmbeddingStatus();
  const repos = force ? await getReposForEmbedding() : await getReposWithoutEmbedding();

  if (repos.length === 0) {
    const count = await (await getTable()).countRows();
    let metadataUpdated = false;
    if (count > 0) {
      setHasEmbeddings(true);
      if (status.metadataStatus === 'missing') {
        setEmbeddingMetadata();
        metadataUpdated = true;
      }
    }
    return {
      totalRepos: count,
      processedRepos: 0,
      skippedRepos: count,
      forced: force,
      metadataUpdated,
      metadataStatusBefore: status.metadataStatus,
    };
  }

  let generatedDone = 0;
  let nextIndex = 0;
  const generated: Array<{ fullName: string; vector: number[] }> = new Array(repos.length);

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= repos.length) return;

      const repo = repos[index];
      const vector = await generate(repoToText(repo));
      generated[index] = { fullName: repo.full_name, vector };
      generatedDone++;
      onProgress?.(generatedDone, repos.length);
    }
  }

  const workerCount = Math.min(EMBEDDING_CONCURRENCY, repos.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (let i = 0; i < generated.length; i += EMBEDDING_WRITE_BATCH_SIZE) {
    const batch = generated.slice(i, i + EMBEDDING_WRITE_BATCH_SIZE);
    await updateEmbeddingsBatch(batch);
  }

  setHasEmbeddings(true);
  let metadataUpdated = false;
  const shouldUpdateMetadata = force || status.metadataStatus !== 'outdated';
  if (shouldUpdateMetadata) {
    setEmbeddingMetadata();
    metadataUpdated = true;
  }

  return {
    totalRepos: status.totalRepos,
    processedRepos: generated.length,
    skippedRepos: force ? 0 : status.embeddedRepos,
    forced: force,
    metadataUpdated,
    metadataStatusBefore: status.metadataStatus,
  };
}
