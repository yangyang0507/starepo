import {
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  generateAndStoreEmbeddings,
  getEmbeddingStatus,
} from '../lib/embeddings.js';
import { note, Progress, success, warn } from '../lib/term.js';

export async function runEmbed(options: { force?: boolean } = {}): Promise<void> {
  const status = await getEmbeddingStatus();
  const rebuildHint = `Run \`starepo embed --force\` to rebuild with ${EMBEDDING_MODEL}@${EMBEDDING_VERSION}.`;
  const storedModel = `${status.metadata.model}@${status.metadata.version}`;

  if (status.totalRepos === 0) {
    note('No repositories found. Run `starepo sync` first.');
    return;
  }

  if (!options.force && status.missingRepos === 0) {
    if (status.metadataStatus === 'outdated') {
      warn(`All ${status.totalRepos} repos have embeddings, but they use ${storedModel}. ${rebuildHint}`);
    } else {
      success(`All ${status.totalRepos} repos already have embeddings. Use --force to regenerate.`);
    }
    return;
  }

  if (!options.force && status.metadataStatus === 'outdated') {
    warn(`Stored embeddings use ${storedModel}; this run only fills missing vectors. ${rebuildHint}`);
  }

  let progress: Progress | undefined;
  const result = await generateAndStoreEmbeddings({
    force: options.force,
    onProgress: (done, total) => {
      progress ??= new Progress({ label: options.force ? 'Re-embedding' : 'Embedding', total });
      progress.update(done);
    },
  });
  progress?.finish();

  const coveredRepos = Math.min(result.totalRepos, result.processedRepos + result.skippedRepos);
  success(`Embedded ${result.processedRepos} repos · coverage ${coveredRepos}/${result.totalRepos}`);
}
