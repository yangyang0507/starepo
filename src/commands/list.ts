import { formatRepo, formatRepoInfo } from '../lib/format.js';
import { listRepos, getRepoByName, getStats, type Repo } from '../lib/storage.js';
import { hybridSearch } from '../lib/search.js';
import { parsePositiveIntOption, sortRepos, SortField, SortOrder } from '../lib/sort.js';
import { formatRelativeTime, writeBanner } from '../lib/term.js';

export interface ListCommandOptions {
  query?: string;
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  limit?: number;
  sort?: SortField;
  order?: SortOrder;
  json?: boolean;
  oneline?: boolean;
}

export async function runList(options: ListCommandOptions = {}): Promise<void> {
  const { count, lastSync } = await getStats();
  const sort = options.sort ?? 'starred';
  const order = options.order ?? 'desc';
  const limit = parsePositiveIntOption(options.limit ?? 50, 'limit');

  let repos: Repo[];
  if (options.query) {
    repos = await hybridSearch(options.query, limit, {
      language: options.language,
      topic: options.topic,
      starredAfter: options.starredAfter,
      starredBefore: options.starredBefore,
      sort: options.sort,
      order: options.order,
    });
  } else {
    const all = await listRepos({
      language: options.language,
      topic: options.topic,
      starredAfter: options.starredAfter,
      starredBefore: options.starredBefore,
      limit: undefined,
    });
    repos = sortRepos(all, sort, order).slice(0, limit);
  }

  if (options.json) {
    console.log(JSON.stringify(repos.map(({ vector: _, ...r }) => r), null, 2));
    return;
  }

  writeBanner(`Total stars: ${count}  |  Last sync: ${lastSync ? formatRelativeTime(lastSync) : 'never'}`);

  if (repos.length === 0) {
    console.log('No repositories found. Run `starepo sync` to fetch your stars.');
    return;
  }

  repos.forEach((repo, i) => {
    console.log(formatRepo(repo, { index: i, oneline: options.oneline }));
    if (!options.oneline) console.log();
  });
}

export async function runInfo(fullName: string): Promise<void> {
  const repo = await getRepoByName(fullName);
  if (!repo) {
    console.error(`Repository "${fullName}" not found. Try running \`starepo sync\` first.`);
    process.exit(1);
  }

  console.log(formatRepoInfo(repo));
}
