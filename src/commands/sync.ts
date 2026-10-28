import { ensureAuth } from './auth.js';
import { createOctokit, fetchAllStars, fetchStarsSince } from '../lib/github.js';
import { upsertRepos, getStats, deleteReposMissingFromFullNames, type RepoInput } from '../lib/storage.js';
import { getMeta, setMeta } from '../lib/config.js';
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  generateAndStoreEmbeddings,
  getEmbeddingStatus,
} from '../lib/embeddings.js';
import { note, Progress, Spinner, style, success, warn } from '../lib/term.js';

function formatChanges(added: number, removed: number): string {
  const parts = [];
  if (added > 0) parts.push(`+${added} new`);
  if (removed > 0) parts.push(`−${removed} removed`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

async function syncEmbeddings(): Promise<void> {
  const status = await getEmbeddingStatus();
  if (status.metadataStatus === 'outdated') {
    warn(
      `Embeddings use ${status.metadata.model}@${status.metadata.version}; sync only fills missing vectors. ` +
      `Run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`
    );
  }

  if (status.missingRepos === 0) {
    success(`Embeddings up to date (${status.embeddedRepos}/${status.totalRepos})`);
    return;
  }

  let progress: Progress | undefined;
  const result = await generateAndStoreEmbeddings({
    onProgress: (done, total) => {
      progress ??= new Progress({ label: 'Embedding', total });
      progress.update(done);
    },
  });
  progress?.finish();
  success(`Embedded ${result.processedRepos} repos · semantic search ready`);
}

export async function runSync(
  options: { force?: boolean; incremental?: boolean; noEmbeddings?: boolean } = {},
): Promise<void> {
  const token = await ensureAuth();
  const octokit = createOctokit(token);

  const lastSync = getMeta('last_sync');
  const isIncremental = Boolean(options.incremental) && !options.force && Boolean(lastSync);

  if (options.incremental && !options.force && !lastSync) {
    note('No previous sync found; running a full sync.');
  }

  const { count: before } = await getStats();
  let repos: RepoInput[];

  if (isIncremental) {
    const since = new Date(lastSync!);
    const progress = new Progress({ label: `Fetching stars since ${since.toLocaleDateString()}` });
    repos = await fetchStarsSince(octokit, since, (count) => {
      progress.update(count);
    });
    progress.finish();
    if (repos.length === 0) {
      note('No new stars found.');
      return;
    }
  } else {
    const progress = new Progress({ label: 'Fetching stars' });
    repos = await fetchAllStars(octokit, (count, total) => {
      progress.update(count, total);
    });
    progress.finish();
  }

  if (repos.length > 0) {
    const saving = new Spinner(`Saving ${repos.length} repos…`).start();
    try {
      await upsertRepos(repos);
    } finally {
      saving.stop();
    }
  }

  // A full sync is authoritative: anything missing remotely was unstarred,
  // including the case where the user has no stars left at all.
  const removed = isIncremental
    ? 0
    : await deleteReposMissingFromFullNames(repos.map((repo) => repo.full_name));

  setMeta('last_sync', new Date().toISOString());

  const { count } = await getStats();
  success(`Synced ${count} stars${formatChanges(count - before + removed, removed)}`);
  if (isIncremental) {
    note(style.dim(
      'Incremental sync only adds new stars; run `starepo sync` to refresh metadata and drop unstarred repos.',
      process.stderr,
    ));
  }

  if (!options.noEmbeddings && count > 0) {
    await syncEmbeddings();
  }
}
