import { generateAndStoreEmbeddings } from '../lib/embeddings.js';
import { getStats, getReposWithoutEmbedding } from '../lib/storage.js';

export async function runEmbed(options: { force?: boolean } = {}): Promise<void> {
  const { count } = await getStats();

  if (count === 0) {
    console.log('No repositories found. Run `starepo sync` first.');
    return;
  }

  const without = await getReposWithoutEmbedding();

  if (!options.force && without.length === 0) {
    console.log('All repositories already have embeddings.');
    console.log('Use --force to regenerate all embeddings.');
    return;
  }

  const total = options.force ? count : without.length;
  console.log(`Generating embeddings for ${total} repositories...`);
  console.log('(First run downloads ~23MB model)\n');

  await generateAndStoreEmbeddings((done, total) => {
    const percent = Math.round((done / total) * 100);
    process.stdout.write(`\rProgress: ${done}/${total} (${percent}%)`);
  });

  console.log('\n\nDone! All embeddings generated.');
  console.log('Semantic search is now available.');
}
