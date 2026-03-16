import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  generateAndStoreEmbeddings,
  getEmbeddingStatus,
} from '../lib/embeddings.js';

export async function runEmbed(options: { force?: boolean } = {}): Promise<void> {
  const status = await getEmbeddingStatus();

  if (status.totalRepos === 0) {
    console.log('No repositories found. Run `starepo sync` first.');
    return;
  }

  if (!options.force && status.missingRepos === 0) {
    console.log('All repositories already have embeddings.');
    if (status.metadataStatus === 'outdated') {
      console.log(
        `Stored embeddings use ${status.metadata.model}@${status.metadata.version}; ` +
        `run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`
      );
    } else {
      console.log('Use --force to regenerate all embeddings.');
    }
    return;
  }

  console.log(
    `Embedding coverage: ${status.embeddedRepos}/${status.totalRepos} ready, ${status.missingRepos} missing.`
  );
  if (status.metadataStatus === 'outdated') {
    console.log(
      `Stored embeddings use ${status.metadata.model}@${status.metadata.version}; ` +
      `${options.force ? 'rebuilding all vectors' : 'this run only fills missing vectors'}.`
    );
  }

  const total = options.force ? status.totalRepos : status.missingRepos;
  console.log(`${options.force ? 'Regenerating' : 'Generating'} embeddings for ${total} repositories...`);
  console.log('(First run downloads ~23MB model)\n');

  const result = await generateAndStoreEmbeddings({
    force: options.force,
    onProgress: (done, total) => {
    const percent = Math.round((done / total) * 100);
    process.stdout.write(`\rProgress: ${done}/${total} (${percent}%)`);
    },
  });

  console.log(`\n\nDone! Processed ${result.processedRepos} repositories.`);
  if (result.skippedRepos > 0) {
    console.log(`Skipped ${result.skippedRepos} repositories that already had embeddings.`);
  }
  if (!options.force && result.metadataStatusBefore === 'outdated') {
    console.log(
      `Older vectors still remain. Run \`starepo embed --force\` to fully rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`
    );
  }
  const coveredRepos = Math.min(result.totalRepos, result.processedRepos + result.skippedRepos);
  console.log(`Embedding coverage is now ${coveredRepos}/${result.totalRepos}.`);
  console.log('Semantic search is now available.');
}
