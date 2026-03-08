import { listRepos, getRepoByName, getStats, Repo } from '../lib/storage.js';
import { hybridSearch } from '../lib/search.js';

export interface ListCommandOptions {
  query?: string;
  language?: string;
  topic?: string;
  starredAfter?: string;
  starredBefore?: string;
  limit?: number;
  json?: boolean;
}

function formatRepo(repo: Repo): string {
  const topics = (() => {
    try { return (JSON.parse(repo.topics) as string[]).join(', '); }
    catch { return repo.topics; }
  })();
  return [
    `${repo.full_name}${repo.language ? ` [${repo.language}]` : ''}`,
    `  ${repo.description || '(no description)'}`,
    `  ${repo.html_url}`,
    topics ? `  Topics: ${topics}` : '',
    `  Stars: ${repo.stars_count}  |  Starred at: ${repo.starred_at || 'unknown'}`,
  ].filter(Boolean).join('\n');
}

export async function runList(options: ListCommandOptions = {}): Promise<void> {
  const { count, lastSync } = await getStats();
  const repos = options.query
    ? await hybridSearch(options.query, options.limit ?? 50, {
      language: options.language,
      topic: options.topic,
      starredAfter: options.starredAfter,
      starredBefore: options.starredBefore,
    })
    : await listRepos({
      language: options.language,
      topic: options.topic,
      starredAfter: options.starredAfter,
      starredBefore: options.starredBefore,
      limit: options.limit,
    });

  if (options.json) {
    console.log(JSON.stringify(repos.map(({ vector: _, ...r }) => r), null, 2));
    return;
  }

  console.log(`Total stars: ${count}  |  Last sync: ${lastSync ? new Date(lastSync).toLocaleString() : 'never'}\n`);

  if (repos.length === 0) {
    console.log('No repositories found. Run `starepo sync` to fetch your stars.');
    return;
  }

  repos.forEach((repo, i) => {
    console.log(`${i + 1}. ${formatRepo(repo)}\n`);
  });
}

export async function runInfo(fullName: string): Promise<void> {
  const repo = await getRepoByName(fullName);
  if (!repo) {
    console.error(`Repository "${fullName}" not found. Try running \`starepo sync\` first.`);
    process.exit(1);
  }

  const topics = (() => {
    try { return (JSON.parse(repo.topics) as string[]).join(', '); }
    catch { return repo.topics; }
  })();

  console.log([
    `Name:        ${repo.full_name}`,
    `URL:         ${repo.html_url}`,
    `Description: ${repo.description || '(none)'}`,
    `Language:    ${repo.language || '(none)'}`,
    `Topics:      ${topics || '(none)'}`,
    `Stars:       ${repo.stars_count}`,
    `Forks:       ${repo.forks_count}`,
    `Homepage:    ${repo.homepage || '(none)'}`,
    `Starred at:  ${repo.starred_at || 'unknown'}`,
    `Updated at:  ${repo.updated_at || 'unknown'}`,
  ].join('\n'));
}
