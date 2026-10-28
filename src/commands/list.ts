import { formatRepoInfo, formatRepoList, queryTerms, staleSyncHint } from '../lib/format.js';
import { listRepos, getRepoByName, getStats, type Repo } from '../lib/storage.js';
import { hybridSearch } from '../lib/search.js';
import { parsePositiveIntOption, sortRepos, SortField, SortOrder } from '../lib/sort.js';
import { formatRelativeTime, note, style, warn, writePaged } from '../lib/term.js';

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
  pager?: boolean;
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

  if (repos.length === 0) {
    note(count === 0 ? 'No local data. Run `starepo sync` to fetch your stars.' : 'No repositories match these filters.');
    return;
  }

  const synced = `synced ${lastSync ? formatRelativeTime(lastSync) : 'never'}`;
  note(
    `${style.bold(`${repos.length} of ${count} stars`, process.stderr)}` +
    `${style.gray(` · ${synced}`, process.stderr)}\n`,
  );
  await writePaged(
    formatRepoList(repos, {
      oneline: options.oneline,
      highlight: queryTerms(options.query ?? ''),
      time: sort === 'updated' ? 'updated' : 'starred',
    }),
    { enabled: options.pager },
  );

  const hint = staleSyncHint(lastSync);
  if (hint) {
    note();
    warn(hint);
  }
}

/** Accepts `owner/repo` as well as pasted GitHub URLs like `https://github.com/owner/repo.git`. */
export function normalizeRepoRef(input: string): string {
  return input
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
}

/** Repos whose name resembles `ref`, most-starred first. */
export function suggestRepos(ref: string, repos: Repo[], max = 3): Repo[] {
  const needle = ref.toLowerCase();
  const name = needle.split('/').pop() ?? needle;
  if (!name) return [];
  return repos
    .filter((repo) => repo.name.toLowerCase() === name || repo.full_name.toLowerCase().includes(name))
    .sort((a, b) => b.stars_count - a.stars_count)
    .slice(0, max);
}

export async function runInfo(input: string): Promise<void> {
  const ref = normalizeRepoRef(input);
  let repo = await getRepoByName(ref);

  if (!repo) {
    const all = await listRepos();
    const sameName = all.filter((candidate) => candidate.full_name.toLowerCase() === ref.toLowerCase());
    if (sameName.length === 1) {
      repo = sameName[0];
    } else {
      const suggestions = suggestRepos(ref, all);
      const hint = suggestions.length > 0
        ? `Did you mean:\n${suggestions.map((candidate) => `  ${candidate.full_name}`).join('\n')}`
        : 'If you starred it recently, run `starepo sync` first.';
      throw new Error(`Repository "${ref}" not found in your stars.\n${hint}`);
    }
  }

  console.log(formatRepoInfo(repo));
}
