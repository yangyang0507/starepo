import { formatAge, languageCell, parseTopics, type Cell } from '../lib/format.js';
import type { Repo } from '../lib/storage.js';
import {
  displayWidth,
  formatCount,
  formatRelativeTime,
  padEnd,
  padStart,
  stripAnsi,
  style,
  truncate,
  wrapText,
} from '../lib/term.js';
import type { BrowseSort, BrowseState } from './state.js';

export interface ViewContext {
  width: number;
  height: number;
  now?: number;
  /** Current spinner glyph, shown while work is in flight. */
  spinner?: string;
  semanticAvailable: boolean;
  modelLoading: boolean;
}

export interface Frame {
  lines: string[];
  /** Zero-based position for the real cursor, so IME candidate windows open at the query. */
  cursor: { row: number; col: number };
}

// Prompt + rule + column titles above the list; rule + key hints below it.
const TOP_ROWS = 3;
const BOTTOM_ROWS = 2;
// Below this width the preview pane is dropped for a one-line description strip.
const PREVIEW_MIN_WIDTH = 100;
const DIVIDER = ' │ ';
const GAP = '  ';
const MARKER_WIDTH = 2;
const STARS_WIDTH = 6;
const AGE_WIDTH = 7;
const LANGUAGE_WIDTH = 12;

const SORT_LABELS: Record<BrowseSort, string> = {
  relevance: 'relevance',
  starred: 'recently starred',
  stars: 'most stars',
  updated: 'recently updated',
};

function columns(width: number) {
  if (width < PREVIEW_MIN_WIDTH) return { listWidth: width, previewWidth: 0 };
  const previewWidth = Math.min(64, Math.max(36, Math.round(width * 0.4)));
  return { listWidth: width - previewWidth - DIVIDER.length, previewWidth };
}

/** Rows available to the result list for a terminal of this size. */
export function listHeight(width: number, height: number): number {
  const descriptionStrip = columns(width).previewWidth === 0 ? 1 : 0;
  return Math.max(1, height - TOP_ROWS - BOTTOM_ROWS - descriptionStrip);
}

function cell(plain: string, styled = plain): Cell {
  return { text: styled, width: displayWidth(plain) };
}

function join(cells: Cell[]): Cell {
  return { text: cells.map((c) => c.text).join(''), width: cells.reduce((sum, c) => sum + c.width, 0) };
}

function repoName(fullName: string, width: number, emphasis: boolean): Cell {
  const plain = truncate(fullName, width);
  const slash = plain.indexOf('/');
  const owner = slash === -1 ? '' : plain.slice(0, slash + 1);
  const name = plain.slice(owner.length);
  return cell(plain, style.gray(owner) + (emphasis ? style.bold(style.cyan(name)) : name));
}

function promptLine(state: BrowseState, ctx: ViewContext): { line: string; col: number } {
  const total = `${state.results.length}/${state.all.length}`;
  let status = '';
  if (state.searching) status = `${ctx.spinner ?? '…'} searching`;
  else if (ctx.modelLoading) status = `${ctx.spinner ?? '…'} loading model`;
  else if (state.query.trim()) status = state.source === 'semantic' ? 'semantic' : ctx.semanticAvailable ? 'keyword' : 'keyword only';
  const right = cell(`${status}${status ? '  ' : ''}${total} `, style.gray(`${status}${status ? '  ' : ''}`) + `${total} `);

  const prefix = cell(' ❯ ', ` ${style.cyan('❯')} `);
  const room = Math.max(1, ctx.width - prefix.width - right.width - 2);
  // Long queries scroll: keep the end (where the cursor is) visible.
  let query = state.query;
  while (displayWidth(query) > room) query = Array.from(query).slice(1).join('');
  const input = state.query
    ? cell(query)
    : cell(`Search ${state.all.length} stars…`, style.gray(`Search ${state.all.length} stars…`));

  const left = join([prefix, input]);
  const line = left.text + ' '.repeat(Math.max(1, ctx.width - left.width - right.width)) + right.text;
  return { line, col: prefix.width + (state.query ? displayWidth(query) : 0) };
}

function listRows(state: BrowseState, width: number, rows: number, now: number): string[] {
  const showLanguage = width - MARKER_WIDTH - LANGUAGE_WIDTH - STARS_WIDTH - AGE_WIDTH - GAP.length * 3 >= 28;
  const nameWidth = Math.max(8, width - MARKER_WIDTH - STARS_WIDTH - AGE_WIDTH - GAP.length * 2 -
    (showLanguage ? LANGUAGE_WIDTH + GAP.length : 0));
  const time = state.sort === 'updated' ? 'updated' : 'starred';

  const titles = (name: string, language: string, stars: string, age: string) => style.gray(
    ' '.repeat(MARKER_WIDTH) + [
      padEnd(name, nameWidth),
      ...(showLanguage ? [padEnd(language, LANGUAGE_WIDTH)] : []),
      padStart(stars, STARS_WIDTH),
      padStart(age, AGE_WIDTH),
    ].join(GAP),
  );
  const lines = [titles('REPOSITORY', 'LANGUAGE', 'STARS', time.toUpperCase())];

  if (state.results.length === 0) {
    const empty = state.searching
      ? 'Searching…'
      : state.query.trim() ? `No stars match "${state.query.trim()}"` : 'No stars yet — run `starepo sync`';
    lines.push('', `${' '.repeat(MARKER_WIDTH)}${style.gray(truncate(empty, width - MARKER_WIDTH))}`);
  }

  state.results.slice(state.offset, state.offset + rows).forEach((repo, i) => {
    const selected = state.offset + i === state.selected;
    const marker = selected ? style.cyan('▌ ') : '  ';
    const name = repoName(repo.full_name, nameWidth, selected);
    const language = languageCell(repo.language);
    const count = `★ ${padStart(formatCount(repo.stars_count), STARS_WIDTH - 2)}`;
    const age = formatAge(time === 'updated' ? repo.updated_at : repo.starred_at, now);
    lines.push(marker + [
      padEnd(name.text, nameWidth, name.width),
      ...(showLanguage ? [padEnd(language.text, LANGUAGE_WIDTH, language.width)] : []),
      style.yellow(count),
      style.gray(padStart(age, AGE_WIDTH)),
    ].join(GAP));
  });

  return lines;
}

function previewLines(repo: Repo | undefined, width: number, height: number, now: number): string[] {
  if (!repo) return [];
  const head = [
    repoName(repo.full_name, width, true).text,
    [
      ...(repo.language ? [languageCell(repo.language).text] : []),
      style.yellow(`★ ${formatCount(repo.stars_count)}`),
      style.gray(`forks ${formatCount(repo.forks_count)}`),
    ].join(GAP),
    '',
  ];

  const topics = parseTopics(repo.topics).map((topic) => `#${topic}`).join(' ');
  const label = (name: string, value: string) => `${style.gray(name.padEnd(9))}${truncate(value, width - 9)}`;
  const tail = [
    ...(topics ? ['', ...wrapText(topics, width, 2).map((line) => style.gray(line))] : []),
    '',
    label('Starred', formatRelativeTime(repo.starred_at, now)),
    label('Updated', formatRelativeTime(repo.updated_at, now)),
    ...(repo.homepage ? [label('Homepage', repo.homepage)] : []),
    style.gray(truncate(repo.html_url, width)),
  ];

  const description = (repo.description || '').replace(/\s+/g, ' ').trim();
  const room = Math.max(1, height - head.length - tail.length);
  const body = description ? wrapText(description, width, room) : [style.gray('No description')];
  return [...head, ...body, ...tail].slice(0, height);
}

function footerLine(state: BrowseState, width: number): string {
  const hint = (key: string, label: string) => cell(`${key} ${label}`, `${key} ${style.gray(label)}`);
  const hints = [
    hint('↑↓', 'move'),
    hint('⏎', 'open'),
    hint('^Y', 'copy url'),
    hint('⇥', `sort: ${SORT_LABELS[state.sort]}`),
    hint('esc', state.query ? 'clear' : 'quit'),
  ];
  const message = state.message ? cell(`${state.message} `, `${style.green(state.message)} `) : cell('');

  // Drop trailing hints rather than wrapping when the terminal is narrow.
  let left = cell(' ');
  for (const h of hints) {
    const next = join(left.width > 1 ? [left, cell(GAP), h] : [left, h]);
    if (next.width + message.width + 1 > width) break;
    left = next;
  }
  return left.text + ' '.repeat(Math.max(1, width - left.width - message.width)) + message.text;
}

export function renderFrame(state: BrowseState, ctx: ViewContext): Frame {
  const now = ctx.now ?? Date.now();
  const { listWidth, previewWidth } = columns(ctx.width);
  const rows = listHeight(ctx.width, ctx.height);
  const rule = style.gray('─'.repeat(ctx.width));
  const prompt = promptLine(state, ctx);

  const list = listRows(state, listWidth, rows, now);
  const bodyHeight = rows + 1;
  const body: string[] = [];
  if (previewWidth > 0) {
    const preview = previewLines(state.results[state.selected], previewWidth, bodyHeight, now);
    for (let i = 0; i < bodyHeight; i++) {
      const left = list[i] ?? '';
      body.push(padEnd(left, listWidth, displayWidth(stripAnsi(left))) + style.gray(DIVIDER) + (preview[i] ?? ''));
    }
  } else {
    for (let i = 0; i < bodyHeight; i++) body.push(list[i] ?? '');
    const selected = state.results[state.selected];
    const strip = selected?.description?.replace(/\s+/g, ' ').trim() ?? '';
    body.push(style.gray(truncate(` ${strip}`, ctx.width)));
  }

  const lines = [prompt.line, rule, ...body, rule, footerLine(state, ctx.width)];
  return { lines: lines.slice(0, ctx.height), cursor: { row: 0, col: prompt.col } };
}

