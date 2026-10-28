import { describe, expect, it } from 'vitest';
import type { Repo } from '../src/lib/storage.js';
import { displayWidth, stripAnsi } from '../src/lib/term.js';
import {
  applySemanticResults,
  handleKey,
  initialState,
  keywordFilter,
  scrollIntoView,
  type BrowseState,
  type Key,
} from '../src/tui/state.js';
import { listHeight, renderFrame } from '../src/tui/view.js';

function makeRepo(fullName: string, overrides: Partial<Repo> = {}): Repo {
  const name = fullName.split('/')[1];
  return {
    id: 1,
    full_name: fullName,
    name,
    description: '',
    html_url: `https://github.com/${fullName}`,
    homepage: '',
    language: 'TypeScript',
    topics: '[]',
    stars_count: 100,
    forks_count: 1,
    starred_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const repos = [
  makeRepo('acme/vector-db', { description: 'Embedded vector database', stars_count: 50, starred_at: '2026-03-01T00:00:00Z' }),
  makeRepo('acme/tui-kit', { description: 'Terminal UI widgets', stars_count: 900, starred_at: '2026-02-01T00:00:00Z' }),
  makeRepo('someone/db-tools', { description: 'Database helpers', stars_count: 10, starred_at: '2026-01-01T00:00:00Z' }),
];

const names = (state: BrowseState) => state.results.map((repo) => repo.full_name);
const press = (state: BrowseState, text: string | undefined, key: Key = {}) => handleKey(state, text, key, 10);
const type = (state: BrowseState, text: string) =>
  Array.from(text).reduce((s, char) => press(s, char, { name: char }).state, state);

describe('browse state', () => {
  it('starts with every star, newest first', () => {
    expect(names(initialState(repos))).toEqual(['acme/vector-db', 'acme/tui-kit', 'someone/db-tools']);
  });

  it('filters as you type, ranking name hits above description hits', () => {
    expect(keywordFilter(repos, 'db').map((repo) => repo.full_name)).toEqual(['someone/db-tools', 'acme/vector-db']);
    expect(keywordFilter(repos, 'terminal widgets').map((repo) => repo.full_name)).toEqual(['acme/tui-kit']);
    expect(keywordFilter(repos, 'db nothing')).toEqual([]);
  });

  it('switches to relevance while searching and back when the query is cleared', () => {
    const searching = type(initialState(repos), 'db');
    expect(searching.query).toBe('db');
    expect(searching.sort).toBe('relevance');

    const cleared = press(searching, undefined, { name: 'escape' });
    expect(cleared.effect).toBe('search');
    expect(cleared.state.query).toBe('');
    expect(cleared.state.sort).toBe('starred');
  });

  it('asks for a semantic search when the query changes, and only then', () => {
    expect(press(initialState(repos), 'd', { name: 'd' }).effect).toBe('search');
    expect(press(initialState(repos), undefined, { name: 'down' }).effect).toBeUndefined();
    expect(press(initialState(repos), undefined, { name: 'backspace' }).effect).toBeUndefined();
  });

  it('edits the query with backspace, ctrl-w, and ctrl-u, and ignores control input', () => {
    let state = type(initialState(repos), 'vector db');
    state = press(state, undefined, { name: 'backspace' }).state;
    expect(state.query).toBe('vector d');
    state = press(state, undefined, { name: 'w', ctrl: true }).state;
    expect(state.query).toBe('vector ');
    state = press(state, '\x1b[Z', { name: 'undefined' }).state;
    expect(state.query).toBe('vector ');
    state = press(state, undefined, { name: 'u', ctrl: true }).state;
    expect(state.query).toBe('');
  });

  it('accepts CJK input', () => {
    expect(type(initialState(repos), '向量').query).toBe('向量');
  });

  it('moves the selection within bounds and keeps it visible', () => {
    let state = initialState(repos);
    state = press(state, undefined, { name: 'up' }).state;
    expect(state.selected).toBe(0);
    state = press(state, undefined, { name: 'end' }).state;
    expect(state.selected).toBe(2);
    expect(scrollIntoView(state, 2).offset).toBe(1);
    expect(scrollIntoView({ ...state, selected: 0, offset: 1 }, 2).offset).toBe(0);
  });

  it('cycles sorts and keeps the selected repo selected', () => {
    let state = press(initialState(repos), undefined, { name: 'down' }).state;
    expect(state.results[state.selected].full_name).toBe('acme/tui-kit');
    state = press(state, undefined, { name: 'tab' }).state;
    expect(state.sort).toBe('stars');
    expect(names(state)).toEqual(['acme/tui-kit', 'acme/vector-db', 'someone/db-tools']);
    expect(state.results[state.selected].full_name).toBe('acme/tui-kit');
  });

  it('maps action keys to effects', () => {
    const state = initialState(repos);
    expect(press(state, '\r', { name: 'return' }).effect).toBe('open');
    expect(press(state, undefined, { name: 'y', ctrl: true }).effect).toBe('copy');
    expect(press(state, undefined, { name: 'c', ctrl: true }).effect).toBe('quit');
    expect(press(state, undefined, { name: 'escape' }).effect).toBe('quit');
  });

  it('drops semantic results that arrive after the query moved on', () => {
    const state = type(initialState(repos), 'db');
    const semantic = [repos[1]];
    expect(applySemanticResults(state, 'old query', semantic)).toBe(state);
    const applied = applySemanticResults(state, 'db', semantic);
    expect(applied.source).toBe('semantic');
    expect(names(applied)).toEqual(['acme/tui-kit']);
  });

  it('keeps a navigated-to repo selected across semantic results, but otherwise leads with the best match', () => {
    const searching = type(initialState(repos), 'db');
    const semantic = [repos[1], repos[0], repos[2]];

    const untouched = applySemanticResults(searching, 'db', semantic);
    expect(untouched.selected).toBe(0);

    const moved = press(searching, undefined, { name: 'down' }).state;
    const followed = applySemanticResults(moved, 'db', semantic);
    expect(followed.results[followed.selected].full_name).toBe(moved.results[moved.selected].full_name);
  });
});

describe('browse view', () => {
  const now = Date.parse('2026-04-01T00:00:00Z');
  const ctx = (width: number, height: number) => ({ width, height, now, semanticAvailable: true, modelLoading: false });

  it('fills the terminal exactly and never overflows its width', () => {
    for (const [width, height] of [[120, 30], [80, 20], [40, 12]]) {
      const frame = renderFrame(type(initialState(repos), 'db'), ctx(width, height));
      expect(frame.lines).toHaveLength(height);
      for (const line of frame.lines) expect(displayWidth(stripAnsi(line))).toBeLessThanOrEqual(width);
    }
  });

  it('shows a preview pane for the selection on wide terminals', () => {
    const state = { ...initialState(repos), selected: 1 };
    const text = renderFrame(state, ctx(120, 20)).lines.map(stripAnsi).join('\n');
    expect(text).toContain('│ acme/tui-kit');
    expect(text).toContain('Terminal UI widgets');
    expect(text).toMatch(/▌ acme\/tui-kit/);
  });

  it('falls back to a description strip on narrow terminals', () => {
    const lines = renderFrame(initialState(repos), ctx(80, 12)).lines.map(stripAnsi);
    expect(lines.join('\n')).not.toContain('│');
    expect(lines[lines.length - 3]).toContain('Embedded vector database');
  });

  it('places the cursor right after the query', () => {
    const frame = renderFrame(type(initialState(repos), '向量'), ctx(100, 20));
    expect(frame.cursor).toEqual({ row: 0, col: 3 + 4 });
  });

  it('explains an empty result list', () => {
    const text = renderFrame(type(initialState(repos), 'zzz'), ctx(100, 20)).lines.map(stripAnsi).join('\n');
    expect(text).toContain('No stars match "zzz"');
    expect(text).toContain('0/3');
  });

  it('sizes the list to the space between header and footer', () => {
    expect(listHeight(120, 30)).toBe(25);
    expect(listHeight(80, 30)).toBe(24);
  });
});
