import { ensureAuth } from './auth.js';
import { createOctokit, fetchAllStars, fetchStarsSince } from '../lib/github.js';
import { upsertRepos, getStats, deleteReposMissingFromFullNames } from '../lib/storage.js';
import { getMeta, setMeta } from '../lib/config.js';
import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  generateAndStoreEmbeddings,
  getEmbeddingStatus,
} from '../lib/embeddings.js';

export async function runSync(options: { incremental?: boolean; noEmbeddings?: boolean } = {}): Promise<void> {
  const token = await ensureAuth();
  const octokit = createOctokit(token);

  let repos;

  if (options.incremental) {
    const lastSync = getMeta('last_sync');
    if (!lastSync) {
      console.log('No previous sync found, running full sync...');
      repos = await fetchAllStars(octokit, (count) => {
        process.stdout.write(`\r  Fetched ${count} repos...`);
      });
    } else {
      const since = new Date(lastSync);
      console.log(`Incremental sync: fetching stars since ${since.toLocaleString()}...`);
      repos = await fetchStarsSince(octokit, since, (count) => {
        process.stdout.write(`\r  Fetched ${count} new stars...`);
      });
    }
  } else {
    console.log('Full sync: fetching all starred repositories...');
    repos = await fetchAllStars(octokit, (count) => {
      process.stdout.write(`\r  Fetched ${count} repos...`);
    });
  }

  console.log();

  if (repos.length === 0) {
    if (!options.incremental) {
      // Full sync with an empty remote result means the user currently has no starred repos,
      // so the local cache must be fully cleared to stay in sync.
      const removed = await deleteReposMissingFromFullNames([]);
      setMeta('last_sync', new Date().toISOString());
      if (removed > 0) {
        console.log(`Removed ${removed} stale repos from local database.`);
      } else {
        console.log('No starred repositories found. Local database is already up to date.');
      }
      const { count } = await getStats();
      console.log(`\nSync complete: ${count} total stars.`);
      return;
    }

    console.log('No new stars found.');
    return;
  }

  process.stdout.write(`Saving ${repos.length} repos to local database...`);
  await upsertRepos(repos);
  console.log(' Done.');

  if (!options.incremental) {
    const removed = await deleteReposMissingFromFullNames(repos.map((repo) => repo.full_name));
    if (removed > 0) {
      console.log(`Removed ${removed} stale repos from local database.`);
    }
  }

  setMeta('last_sync', new Date().toISOString());

  const { count } = await getStats();
  console.log(`\nSync complete: ${count} total stars.`);

  if (!options.noEmbeddings) {
    const embeddingStatus = await getEmbeddingStatus();
    console.log(
      `\nEmbedding coverage: ${embeddingStatus.embeddedRepos}/${embeddingStatus.totalRepos} ready, ` +
      `${embeddingStatus.missingRepos} missing.`
    );
    if (embeddingStatus.metadataStatus === 'outdated') {
      console.log(
        `Stored embeddings use ${embeddingStatus.metadata.model}@${embeddingStatus.metadata.version}; ` +
        `sync only fills missing vectors. Run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`
      );
    }

    if (embeddingStatus.missingRepos === 0) {
      console.log('Embeddings already up to date.');
      console.log('Semantic search is now available.');
      return;
    }

    console.log('Generating embeddings for semantic search...');
    console.log('(First run downloads ~23MB model)');
    const result = await generateAndStoreEmbeddings({
      onProgress: (done, total) => {
        process.stdout.write(`\r  Embedding: ${done}/${total}`);
      },
    });
    console.log(`\nEmbeddings ready. Processed ${result.processedRepos} repositories.`);
    if (result.metadataStatusBefore === 'outdated') {
      console.log(
        `Older vectors still remain. Run \`starepo embed --force\` to fully rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`
      );
    }
    console.log('Semantic search is now available.');
  }
}
