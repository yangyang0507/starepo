import type { Repo } from '../lib/storage.js';
import { sortRepos } from '../lib/sort.js';

export type BrowseSort = 'relevance' | 'starred' | 'stars' | 'updated';

export interface BrowseState {
  /** Every local star, newest first; the result set when the query is empty. */
  all: Repo[];
  query: string;
  /** Matches for `query` in relevance order, before `sort` is applied. */
  matches: Repo[];
  /** `matches` arranged by `sort`; what the list shows. */
  results: Repo[];
  source: 'keyword' | 'semantic';
  sort: BrowseSort;
  selected: number;
  /** Index of the first visible row. */
  offset: number;
  searching: boolean;
  message: string | null;
}

export interface Key {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

export type Effect = 'quit' | 'open' | 'copy' | 'search';

const SORTS_WITH_QUERY: BrowseSort[] = ['relevance', 'starred', 'stars', 'updated'];
const SORTS_WITHOUT_QUERY: BrowseSort[] = ['starred', 'stars', 'updated'];

function arrange(matches: Repo[], sort: BrowseSort): Repo[] {
  return sort === 'relevance' ? matches : sortRepos(matches, sort, 'desc');
}

export function initialState(all: Repo[]): BrowseState {
  const results = arrange(all, 'starred');
  return {
    all: results,
    query: '',
    matches: results,
    results,
    source: 'keyword',
    sort: 'starred',
    selected: 0,
    offset: 0,
    searching: false,
    message: null,
  };
}

const haystacks = new WeakMap<Repo, { name: string; fullName: string; text: string }>();

function haystack(repo: Repo) {
  let entry = haystacks.get(repo);
  if (!entry) {
    entry = {
      name: repo.name.toLowerCase(),
      fullName: repo.full_name.toLowerCase(),
      text: [repo.description, repo.topics_text ?? repo.topics, repo.language].join(' ').toLowerCase(),
    };
    haystacks.set(repo, entry);
  }
  return entry;
}

/**
 * Instant, as-you-type filter: every term must appear somewhere; hits in the
 * repo name rank above hits in the owner, which rank above the description.
 * Ties keep the input order.
 */
export function keywordFilter(repos: Repo[], query: string): Repo[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return repos;
  const scored: Array<{ repo: Repo; score: number }> = [];
  for (const repo of repos) {
    const { name, fullName, text } = haystack(repo);
    let score = 0;
    for (const term of terms) {
      if (name.startsWith(term)) score += 4;
      else if (name.includes(term)) score += 3;
      else if (fullName.includes(term)) score += 2;
      else if (text.includes(term)) score += 1;
      else {
        score = -1;
        break;
      }
    }
    if (score > 0) scored.push({ repo, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(({ repo }) => repo);
}

/** Replaces the result list, keeping the same repo selected when it is still there. */
function withResults(state: BrowseState, matches: Repo[], patch: Partial<BrowseState> = {}): BrowseState {
  const next = { ...state, ...patch };
  const results = arrange(matches, next.sort);
  const current = state.results[state.selected]?.full_name;
  const kept = current === undefined ? -1 : results.findIndex((repo) => repo.full_name === current);
  return { ...next, matches, results, selected: Math.max(0, kept) };
}

export function setQuery(state: BrowseState, query: string): BrowseState {
  if (query === state.query) return state;
  // Relevance is the natural order while searching; plain browsing is newest first.
  let sort = state.sort;
  if (query.trim() && !state.query.trim() && sort === 'starred') sort = 'relevance';
  if (!query.trim() && sort === 'relevance') sort = 'starred';
  const next = withResults(state, keywordFilter(state.all, query), {
    query,
    sort,
    source: 'keyword',
    searching: false,
    message: null,
  });
  return { ...next, selected: 0, offset: 0 };
}

/** Swaps in semantic results, unless the user has typed on since they were requested. */
export function applySemanticResults(state: BrowseState, query: string, repos: Repo[]): BrowseState {
  if (query !== state.query) return state;
  const next = withResults(state, repos, { source: 'semantic', searching: false });
  // Follow the repo only if the user had moved to it; otherwise the best match leads.
  return state.selected === 0 ? { ...next, selected: 0, offset: 0 } : next;
}

export function cycleSort(state: BrowseState): BrowseState {
  const sorts = state.query.trim() ? SORTS_WITH_QUERY : SORTS_WITHOUT_QUERY;
  const sort = sorts[(sorts.indexOf(state.sort) + 1) % sorts.length];
  return withResults(state, state.matches, { sort });
}

export function moveSelection(state: BrowseState, delta: number): BrowseState {
  if (state.results.length === 0) return state;
  const selected = Math.min(state.results.length - 1, Math.max(0, state.selected + delta));
  return { ...state, selected };
}

/** Scrolls just enough to keep the selection within a viewport of `height` rows. */
export function scrollIntoView(state: BrowseState, height: number): BrowseState {
  const rows = Math.max(1, height);
  let offset = Math.min(state.offset, state.selected);
  if (state.selected >= offset + rows) offset = state.selected - rows + 1;
  offset = Math.max(0, Math.min(offset, Math.max(0, state.results.length - rows)));
  return offset === state.offset ? state : { ...state, offset };
}

function deleteWord(query: string): string {
  return query.replace(/\S*\s*$/, '');
}

function isPrintable(text: string | undefined, key: Key): text is string {
  if (!text || key.ctrl || key.meta) return false;
  // Control characters (including ESC-prefixed sequences) never reach the query.
  return !Array.from(text).some((char) => char.charCodeAt(0) < 0x20 || char === '\u007f');
}

/**
 * Applies one keypress. The query field always has focus, so letters type;
 * actions live on keys that cannot be text (arrows, Enter, Tab, Ctrl-…).
 */
export function handleKey(
  state: BrowseState,
  text: string | undefined,
  key: Key,
  pageSize: number,
): { state: BrowseState; effect?: Effect } {
  const name = key.name;
  if (key.ctrl && name === 'c') return { state, effect: 'quit' };
  if (name === 'escape') {
    return state.query ? { state: setQuery(state, ''), effect: 'search' } : { state, effect: 'quit' };
  }
  if (name === 'return' || name === 'enter') return { state, effect: 'open' };
  if (key.ctrl && name === 'y') return { state, effect: 'copy' };
  if (name === 'tab') return { state: cycleSort(state) };

  if (name === 'up' || (key.ctrl && name === 'p')) return { state: moveSelection(state, -1) };
  if (name === 'down' || (key.ctrl && name === 'n')) return { state: moveSelection(state, 1) };
  if (name === 'pageup') return { state: moveSelection(state, -pageSize) };
  if (name === 'pagedown') return { state: moveSelection(state, pageSize) };
  if (name === 'home') return { state: moveSelection(state, -state.results.length) };
  if (name === 'end') return { state: moveSelection(state, state.results.length) };

  let query = state.query;
  if (name === 'backspace') query = key.meta ? deleteWord(query) : Array.from(query).slice(0, -1).join('');
  else if (key.ctrl && name === 'w') query = deleteWord(query);
  else if (key.ctrl && name === 'u') query = '';
  else if (isPrintable(text, key)) query += text;
  else return { state };

  const next = setQuery(state, query);
  return next === state ? { state } : { state: next, effect: 'search' };
}
