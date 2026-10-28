import { getDataDir } from './config.js';
import { setMeta, getMeta } from './config.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { Repo } from './storage.js';
import { note, Progress, Spinner, success } from './term.js';

type FeatureExtractionPipeline = (
  text: string | string[],
  options?: Record<string, unknown>
) => Promise<{ data: Float32Array; dims: number[] }>;

let _pipeline: FeatureExtractionPipeline | null = null;
let _pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
// Texts per inference run. Repo texts are short, so eight fit comfortably in
// a single ONNX batch and amortize the per-call pipeline overhead.
const EMBEDDING_BATCH_SIZE = 8;
const EMBEDDING_WRITE_BATCH_SIZE = 25;
export const EMBEDDING_MODEL = 'Xenova/bge-m3';
export const EMBEDDING_MODEL_DTYPE = 'q8';
// transformers.js stores q8 weights under this name inside the model's cache folder.
const EMBEDDING_MODEL_WEIGHTS = join('onnx', 'model_quantized.onnx');
export const EMBEDDING_VERSION = '2';

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
  generateBatch?: (texts: string[]) => Promise<number[][] | Float32Array[]>;
}

export interface EmbeddingGenerationResult {
  totalRepos: number;
  processedRepos: number;
  skippedRepos: number;
  forced: boolean;
  metadataUpdated: boolean;
  metadataStatusBefore: EmbeddingMetadataStatus;
}

export interface ModelDownloadProgressInfo {
  status: string;
  loaded?: number;
  total?: number;
}

export function applyModelDownloadProgress(
  info: ModelDownloadProgressInfo,
  slot: { current?: Progress },
  createProgress: (total: number) => Progress = (total) => new Progress({ label: 'Downloading', total, unit: 'bytes' }),
): void {
  if (info.status === 'progress_total' && typeof info.loaded === 'number' && typeof info.total === 'number' && info.total > 0) {
    slot.current ??= createProgress(info.total);
    slot.current.update(info.loaded);
    return;
  }
  if (info.status === 'ready') {
    slot.current?.finish();
  }
}

function modelCacheDir(): string {
  return join(getDataDir(), 'models');
}

/** Whether the model weights are on disk, i.e. loading them needs no download. */
export function isEmbeddingModelCached(): boolean {
  return existsSync(join(modelCacheDir(), EMBEDDING_MODEL, EMBEDDING_MODEL_WEIGHTS));
}

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;
  if (_pipelinePromise) return _pipelinePromise;

  _pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');

    // Store model cache in XDG data dir (~/.local/share/starepo/models)
    // instead of node_modules, so it persists across installs and updates.
    const cacheDir = modelCacheDir();
    env.cacheDir = cacheDir;

    // transformers.js reports byte progress even when reading its own cache, so
    // decide from disk whether this is a real download worth a progress bar.
    if (isEmbeddingModelCached()) {
      const spinner = new Spinner('Loading embedding model…').start();
      try {
        _pipeline = (await pipeline('feature-extraction', EMBEDDING_MODEL, {
          dtype: EMBEDDING_MODEL_DTYPE,
        })) as unknown as FeatureExtractionPipeline;
      } finally {
        spinner.stop();
      }
    } else {
      note(`Downloading embedding model ${EMBEDDING_MODEL} (${EMBEDDING_MODEL_DTYPE}, ~550 MB, one-time)…`);
      const download = { current: undefined as Progress | undefined };
      try {
        _pipeline = (await pipeline('feature-extraction', EMBEDDING_MODEL, {
          dtype: EMBEDDING_MODEL_DTYPE,
          progress_callback: (info: ModelDownloadProgressInfo) => applyModelDownloadProgress(info, download),
        })) as unknown as FeatureExtractionPipeline;
      } finally {
        download.current?.finish();
      }
      success(`Embedding model cached in ${cacheDir}`);
    }
    return _pipeline;
  })();

  try {
    return await _pipelinePromise;
  } catch (err) {
    _pipelinePromise = null;
    throw err;
  }
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

function validateGeneratedEmbedding(vector: number[] | Float32Array, fullName: string, expectedDim: number): void {
  if (vector.length !== expectedDim) {
    throw new Error(`Generated embedding for ${fullName} must contain ${expectedDim} dimensions; received ${vector.length}.`);
  }
}

function cloneEmbeddingVector(vector: ArrayLike<number>): Float32Array {
  return Float32Array.from(vector);
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

export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const output = await pipe(texts, { pooling: 'mean', normalize: true });
  const dim = output.dims[output.dims.length - 1];
  // Copy out of the pipeline output buffer so a later inference call cannot
  // mutate vectors that are still waiting to be written.
  return texts.map((_, i) => cloneEmbeddingVector(output.data.subarray(i * dim, (i + 1) * dim)));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return Array.from((await generateEmbeddings([text]))[0]);
}

export async function generateAndStoreEmbeddings(
  options: EmbeddingGenerationOptions = {}
): Promise<EmbeddingGenerationResult> {
  const { force = false, onProgress, generateBatch = generateEmbeddings } = options;
  const {
    EMBEDDING_DIM,
    getReposWithoutEmbedding,
    getReposForEmbedding,
    updateEmbeddingsBatch,
    setHasEmbeddings,
    getTable,
  } = await import('./storage.js');
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
  let pending: Array<{ fullName: string; vector: Float32Array }> = [];
  let writeQueue: Promise<void> = Promise.resolve();

  // Persist generated vectors as soon as a batch fills up so an interrupted
  // run keeps its completed work and `starepo embed` can resume where it
  // stopped, instead of losing everything when the process exits early.
  function flush(force: boolean): Promise<void> {
    if (pending.length === 0 || (!force && pending.length < EMBEDDING_WRITE_BATCH_SIZE)) {
      return writeQueue;
    }
    const batch = pending;
    pending = [];
    writeQueue = writeQueue.then(() => updateEmbeddingsBatch(batch));
    return writeQueue;
  }

  for (let i = 0; i < repos.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = repos.slice(i, i + EMBEDDING_BATCH_SIZE);
    const vectors = await generateBatch(batch.map(repoToText));
    batch.forEach((repo, j) => {
      validateGeneratedEmbedding(vectors[j], repo.full_name, EMBEDDING_DIM);
      pending.push({ fullName: repo.full_name, vector: cloneEmbeddingVector(vectors[j]) });
      generatedDone++;
      onProgress?.(generatedDone, repos.length);
    });
    await flush(false);
  }
  await flush(true);
  setHasEmbeddings(true);
  let metadataUpdated = false;
  const shouldUpdateMetadata = force || status.metadataStatus !== 'outdated';
  if (shouldUpdateMetadata) {
    setEmbeddingMetadata();
    metadataUpdated = true;
  }

  return {
    totalRepos: status.totalRepos,
    processedRepos: generatedDone,
    skippedRepos: force ? 0 : status.embeddedRepos,
    forced: force,
    metadataUpdated,
    metadataStatusBefore: status.metadataStatus,
  };
}
