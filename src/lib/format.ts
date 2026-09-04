import { Repo } from './storage.js';
import {
  displayWidth,
  formatCount,
  formatRelativeTime,
  hyperlink,
  isTTY,
  style,
  terminalWidth,
  truncate,
} from './term.js';

export function parseTopics(topics: string): string[] {
  try {
    const parsed = JSON.parse(topics) as unknown;
    if (!Array.isArray(parsed)) return topics ? [topics] : [];
    return parsed.filter((topic): topic is string => typeof topic === 'string' && topic.trim().length > 0);
  } catch {
    return topics ? [topics] : [];
  }
}

export interface FormatRepoOptions {
  index?: number;
  oneline?: boolean;
  width?: number;
  link?: boolean;
  now?: number;
}

function repoTitle(repo: Repo, link: boolean): string {
  const name = link ? hyperlink(repo.full_name, repo.html_url) : repo.full_name;
  const language = repo.language ? ` [${style.cyan(repo.language)}]` : '';
  return `${style.bold(name)}${language}`;
}

export function formatRepo(repo: Repo, options: FormatRepoOptions = {}): string {
  const {
    index,
    oneline = false,
    width = terminalWidth(),
    link = isTTY(),
    now,
  } = options;
  const prefix = index === undefined ? '' : `${index + 1}. `;
  const title = repoTitle(repo, link);
  const topics = parseTopics(repo.topics);

  if (oneline) {
    const meta = `★${formatCount(repo.stars_count)}`;
    const visibleTitle = `${prefix}${repo.full_name}${repo.language ? ` [${repo.language}]` : ''}`;
    const used = displayWidth(visibleTitle) + displayWidth(meta) + 4;
    const desc = truncate((repo.description || '').replace(/\s+/g, ' ').trim(), Math.max(0, width - used));
    return [prefix + title, meta, desc].filter(Boolean).join('  ');
  }

  const lines = [
    `${prefix}${title}`,
    `   ${repo.description?.trim() ? repo.description : '(no description)'}`,
  ];
  if (!link && repo.html_url) lines.push(`   ${repo.html_url}`);
  lines.push(
    `   stars ${formatCount(repo.stars_count)}  forks ${formatCount(repo.forks_count)}  starred ${formatRelativeTime(repo.starred_at, now)}`,
  );
  if (topics.length > 0) lines.push(`   Topics: ${topics.slice(0, 5).join(', ')}`);
  return lines.join('\n');
}

export function formatRepoInfo(repo: Repo, options: { link?: boolean; now?: number } = {}): string {
  const link = options.link ?? isTTY();
  const topics = parseTopics(repo.topics);
  const name = link ? hyperlink(repo.full_name, repo.html_url) : repo.full_name;
  const starred = repo.starred_at
    ? `${repo.starred_at} (${formatRelativeTime(repo.starred_at, options.now)})`
    : 'unknown';
  const updated = repo.updated_at
    ? `${repo.updated_at} (${formatRelativeTime(repo.updated_at, options.now)})`
    : 'unknown';

  return [
    `Name:        ${name}`,
    `URL:         ${repo.html_url}`,
    `Description: ${repo.description || '(none)'}`,
    `Language:    ${repo.language || '(none)'}`,
    `Topics:      ${topics.join(', ') || '(none)'}`,
    `Stars:       ${formatCount(repo.stars_count)}`,
    `Forks:       ${formatCount(repo.forks_count)}`,
    `Homepage:    ${repo.homepage || '(none)'}`,
    `Starred at:  ${starred}`,
    `Updated at:  ${updated}`,
  ].join('\n');
}
