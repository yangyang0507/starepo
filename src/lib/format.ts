import { languageColor, shortLanguageName } from './languages.js';
import { Repo } from './storage.js';
import {
  displayWidth,
  formatCount,
  formatRelativeTime,
  hex,
  hyperlink,
  isTTY,
  padEnd,
  padStart,
  style,
  terminalWidth,
  truncate,
  wrapText,
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

/** Splits a search query into words worth highlighting (single characters match too much). */
export function queryTerms(query: string): string[] {
  return query.split(/\s+/).filter((term) => displayWidth(term) >= 2);
}

function termPattern(term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // ASCII words match whole words only, so "ai" skips "OpenAI" but still hits
  // "AI-Startup" or "使用ai生成". Other scripts have no spaces to anchor on.
  return /^[A-Za-z0-9]/.test(term) && /[A-Za-z0-9]$/.test(term)
    ? `(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`
    : escaped;
}

export function highlightTerms(text: string, terms: string[] = []): string {
  if (terms.length === 0 || !text) return text;
  const pattern = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(termPattern)
    .join('|');
  return text.replace(new RegExp(pattern, 'gi'), (match) => style.highlight(match));
}

const STALE_SYNC_MS = 7 * 24 * 60 * 60 * 1000;

export function staleSyncHint(lastSync: string | null | undefined, now = Date.now()): string | null {
  const then = lastSync ? Date.parse(lastSync) : Number.NaN;
  if (Number.isNaN(then) || now - then < STALE_SYNC_MS) return null;
  return `Last synced ${formatRelativeTime(lastSync, now)}. Run \`starepo sync --incremental\` to pick up new stars.`;
}

/** Column-friendly age: `now`, `5m`, `3h`, `6d`, `3w`, `11mo`, `2y`. */
export function formatAge(value: string | null | undefined, now = Date.now()): string {
  const then = value ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(then)) return '–';
  const minutes = Math.max(0, (now - then) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${Math.floor(days)}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export interface RepoListOptions {
  /** One row per repo, description truncated onto the row instead of wrapped below it. */
  oneline?: boolean;
  width?: number;
  link?: boolean;
  /** Column titles above the rows; on by default only for interactive terminals. */
  header?: boolean;
  now?: number;
  /** Query words to emphasize in descriptions. */
  highlight?: string[];
  /** Which timestamp the age column shows. */
  time?: 'starred' | 'updated';
}

const GAP = '  ';
const DESCRIPTION_LINES = 2;
// The table never grows past this on wide terminals: long lines are hard to
// read, and right-aligned columns drift too far from the names they describe.
const MAX_BLOCK_WIDTH = 90;
const MIN_NAME_WIDTH = 16;
const MAX_LANGUAGE_WIDTH = 12;

interface Cell {
  text: string;
  width: number;
}

function cell(plain: string, styled = plain): Cell {
  return { text: styled, width: displayWidth(plain) };
}

function nameCell(fullName: string, width: number, url: string, link: boolean): Cell {
  const plain = truncate(fullName, width);
  const slash = plain.indexOf('/');
  const styled = slash === -1
    ? style.bold(style.cyan(plain))
    : style.gray(plain.slice(0, slash + 1)) + style.bold(style.cyan(plain.slice(slash + 1)));
  return { text: link ? hyperlink(styled, url) : styled, width: displayWidth(plain) };
}

function languageCell(language: string): Cell {
  if (!language) return cell('');
  const name = truncate(shortLanguageName(language), MAX_LANGUAGE_WIDTH - 2);
  const color = languageColor(language);
  const dot = color ? hex(color, '●') : style.gray('●');
  return { text: `${dot} ${name}`, width: displayWidth(name) + 2 };
}

/**
 * Renders repos as an aligned table in the style of `gh` list output:
 * index, owner/name, language, stars, age — with each description wrapped
 * under its name with a hanging indent.
 */
export function formatRepoList(repos: Repo[], options: RepoListOptions = {}): string {
  const {
    oneline = false,
    width = terminalWidth(),
    link = isTTY(),
    header = isTTY(),
    now = Date.now(),
    highlight = [],
    time = 'starred',
  } = options;
  if (repos.length === 0) return '';

  const rows = repos.map((repo, i) => ({
    repo,
    index: String(i + 1),
    stars: formatCount(repo.stars_count),
    age: formatAge(time === 'updated' ? repo.updated_at : repo.starred_at, now),
  }));
  const titles = { name: 'REPOSITORY', language: 'LANGUAGE', stars: 'STARS', age: time.toUpperCase() };
  const widest = (values: string[], title: string) =>
    Math.max(header ? displayWidth(title) : 0, ...values.map((value) => displayWidth(value)));

  const indexWidth = widest(rows.map((row) => row.index), '');
  // Room for "★ " ahead of the right-aligned count, so the stars line up.
  const countWidth = Math.max(...rows.map((row) => displayWidth(row.stars)));
  const starsWidth = Math.max(countWidth + 2, header ? titles.stars.length : 0);
  const ageWidth = widest(rows.map((row) => row.age), titles.age);
  const languages = repos.map((repo) => languageCell(repo.language));
  let languageWidth = languages.some((language) => language.width > 0)
    ? Math.max(header ? titles.language.length : 0, ...languages.map((language) => language.width))
    : 0;

  const fixedWidth = () =>
    indexWidth + GAP.length + (languageWidth ? languageWidth + GAP.length : 0) +
    starsWidth + GAP.length + ageWidth + GAP.length;
  // Narrow terminal: give the repo name priority over the language column.
  if (width - fixedWidth() < MIN_NAME_WIDTH) languageWidth = 0;
  // Full mode stretches the name column so rows and wrapped descriptions share
  // one right edge; --oneline keeps it tight to leave room for the description.
  const fitted = Math.min(widest(repos.map((repo) => repo.full_name), titles.name), width - fixedWidth());
  const stretched = Math.min(width, MAX_BLOCK_WIDTH) - fixedWidth();
  const nameWidth = Math.max(MIN_NAME_WIDTH, oneline ? fitted : Math.max(fitted, stretched));
  const tableWidth = fixedWidth() + nameWidth;

  const line = (index: Cell, name: Cell, language: Cell, stars: Cell, age: Cell) => [
    padStart(index.text, indexWidth, index.width),
    padEnd(name.text, nameWidth, name.width),
    ...(languageWidth ? [padEnd(language.text, languageWidth, language.width)] : []),
    padStart(stars.text, starsWidth, stars.width),
    padStart(age.text, ageWidth, age.width),
  ].join(GAP);

  const out: string[] = [];
  if (header) {
    const title = (text: string) => cell(text, style.gray(text));
    out.push(line(cell(''), title(titles.name), title(titles.language), title(titles.stars), title(titles.age)));
  }

  const indent = ' '.repeat(indexWidth + GAP.length);
  const textWidth = tableWidth - indent.length;

  rows.forEach((row, i) => {
    const { repo } = row;
    let text = line(
      cell(row.index, style.gray(row.index)),
      nameCell(repo.full_name, nameWidth, repo.html_url, link),
      languages[i],
      cell(`★ ${padStart(row.stars, countWidth)}`, style.yellow(`★ ${padStart(row.stars, countWidth)}`)),
      cell(row.age, style.gray(row.age)),
    );
    const description = (repo.description || '').replace(/\s+/g, ' ').trim();

    if (oneline) {
      const room = width - tableWidth - GAP.length;
      if (description && room >= 10) {
        text = text.trimEnd() + GAP + highlightTerms(truncate(description, room), highlight);
      }
      out.push(text.trimEnd());
      return;
    }

    out.push(text.trimEnd());
    for (const descriptionLine of wrapText(description, textWidth, DESCRIPTION_LINES)) {
      out.push(indent + highlightTerms(descriptionLine, highlight));
    }
  });

  return out.join('\n');
}

export function formatRepoInfo(repo: Repo, options: { link?: boolean; now?: number; width?: number } = {}): string {
  const link = options.link ?? isTTY();
  const width = Math.min(options.width ?? terminalWidth(), MAX_BLOCK_WIDTH);
  const topics = parseTopics(repo.topics);
  const name = link ? hyperlink(repo.full_name, repo.html_url) : repo.full_name;
  const starred = repo.starred_at
    ? `${repo.starred_at} (${formatRelativeTime(repo.starred_at, options.now)})`
    : 'unknown';
  const updated = repo.updated_at
    ? `${repo.updated_at} (${formatRelativeTime(repo.updated_at, options.now)})`
    : 'unknown';

  const none = style.gray('(none)');
  const labelWidth = 13;
  const field = (label: string, value: string) => `${style.gray(`${label}:`.padEnd(labelWidth - 1))} ${value}`;
  const description = wrapText((repo.description || '').replace(/\s+/g, ' '), width - labelWidth)
    .join(`\n${' '.repeat(labelWidth)}`);
  return [
    field('Name', style.bold(style.cyan(name))),
    field('URL', repo.html_url),
    field('Description', description || none),
    field('Language', repo.language ? languageCell(repo.language).text : none),
    field('Topics', topics.map((topic) => `#${topic}`).join(' ') || none),
    field('Stars', style.yellow(`★ ${formatCount(repo.stars_count)}`)),
    field('Forks', formatCount(repo.forks_count)),
    field('Homepage', repo.homepage || none),
    field('Starred at', starred),
    field('Updated at', updated),
  ].join('\n');
}
