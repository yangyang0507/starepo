import { ensureAuth } from './auth.js';
import { createOctokit, fetchAllStars, fetchStarsSince } from '../lib/github.js';
import { upsertRepos, getStats } from '../lib/storage.js';
import { getMeta, setMeta } from '../lib/config.js';
import { generateAndStoreEmbeddings } from '../lib/embeddings.js';

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
    console.log('No new stars found.');
    return;
  }

  process.stdout.write(`Saving ${repos.length} repos to local database...`);
  await upsertRepos(repos);
  console.log(' Done.');

  setMeta('last_sync', new Date().toISOString());

  const { count } = await getStats();
  console.log(`\nSync complete: ${count} total stars.`);

  if (!options.noEmbeddings) {
    console.log('\nGenerating embeddings for semantic search...');
    console.log('(First run downloads ~23MB model)');
    await generateAndStoreEmbeddings((done, total) => {
      process.stdout.write(`\r  Embedding: ${done}/${total}`);
    });
    console.log('\nEmbeddings ready. Semantic search is now available.');
  }
}
