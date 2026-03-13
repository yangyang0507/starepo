import { getDataDir } from './config.js';
import { join } from 'path';
import { Repo } from './storage.js';

type FeatureExtractionPipeline = (
  text: string,
  options?: Record<string, unknown>
) => Promise<{ data: Float32Array }>;

let _pipeline: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;

  const { pipeline, env } = await import('@xenova/transformers');

  // Store model cache in XDG data dir (~/.local/share/starepo/models)
  // instead of node_modules, so it persists across installs and updates
  const modelCacheDir = join(getDataDir(), 'models');
  env.cacheDir = modelCacheDir;

  process.stderr.write('Loading embedding model (first-time download may take a while)...\n');
  _pipeline = (await pipeline('feature-extraction', 'Xenova/bge-m3')) as unknown as FeatureExtractionPipeline;
  process.stderr.write('Embedding model ready.\n');
  return _pipeline;
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
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { getReposWithoutEmbedding, updateEmbedding, setHasEmbeddings, getTable } = await import('./storage.js');
  const repos = await getReposWithoutEmbedding();
  if (repos.length === 0) {
    const count = await (await getTable()).countRows();
    if (count > 0) setHasEmbeddings(true);
    return;
  }

  let done = 0;
  for (const repo of repos) {
    const vector = await generateEmbedding(repoToText(repo));
    await updateEmbedding(repo.full_name, vector);
    done++;
    onProgress?.(done, repos.length);
  }

  setHasEmbeddings(true);
}
