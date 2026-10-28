import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';
import {
  formatAge,
  formatRepoInfo,
  formatRepoList,
  highlightTerms,
  parseTopics,
  queryTerms,
  staleSyncHint,
} from '../src/lib/format.js';
import type { Repo } from '../src/lib/storage.js';
import { displayWidth, stripAnsi } from '../src/lib/term.js';

const repo: Repo = {
  id: 1,
  full_name: 'user/repo',
  name: 'repo',
  description: 'A useful repo',
  html_url: 'https://github.com/user/repo',
  homepage: '',
  language: 'TypeScript',
  topics: '["cli","typescript"]',
  stars_count: 1530,
  forks_count: 2,
  starred_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const now = Date.parse('2026-09-02T00:00:00Z');

describe('parseTopics', () => {
  it('reads JSON topic arrays and falls back to raw text', () => {
    expect(parseTopics('["cli","typescript"]')).toEqual(['cli', 'typescript']);
    expect(parseTopics('not-json')).toEqual(['not-json']);
    expect(parseTopics('[]')).toEqual([]);
  });
});

describe('formatRepoList', () => {
  const other: Repo = {
    ...repo,
    full_name: 'someone/a-much-longer-repository-name',
    name: 'a-much-longer-repository-name',
    description: '',
    language: '',
    stars_count: 7,
  };

  it('aligns columns across rows and skips empty descriptions', () => {
    const lines = formatRepoList([repo, other], { link: false, header: true, width: 100, now }).split('\n');

    expect(lines[0]).toMatch(/^\s+REPOSITORY\s+LANGUAGE\s+STARS\s+STARRED$/);
    expect(lines[1]).toMatch(/^1 {2}user\/repo\s+● TypeScript {2}★ 1\.5k\s+8mo$/);
    expect(lines[2]).toBe('   A useful repo');
    expect(lines[3]).toMatch(/^2 {2}someone\/a-much-longer-repository-name\s+★ {4}7\s+8mo$/);
    expect(lines).toHaveLength(4);
    // Every row shares one right edge.
    expect(new Set([lines[0], lines[1], lines[3]].map((line) => displayWidth(line))).size).toBe(1);
  });

  it('wraps long descriptions under the name with a hanging indent', () => {
    const long = { ...repo, description: 'word '.repeat(40).trim() };
    const lines = formatRepoList([long], { link: false, header: false, width: 40, now }).split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('   word')).toBe(true);
    expect(lines[2].startsWith('   word')).toBe(true);
    expect(lines[2].endsWith('…')).toBe(true);
    expect(lines.every((line) => displayWidth(line) <= 40)).toBe(true);
  });

  it('drops the language column before squeezing names on narrow terminals', () => {
    const text = formatRepoList([repo], { link: false, header: false, width: 30, now });
    expect(text).not.toContain('TypeScript');
    expect(text).toContain('user/repo');
  });

  it('puts a truncated description on the row with --oneline', () => {
    const text = formatRepoList([repo], { oneline: true, link: false, header: false, width: 80, now });
    expect(text).toMatch(/^1 {2}user\/repo\s+● TypeScript {2}★ 1\.5k {2}8mo {2}A useful repo$/);
  });

  it('keeps CJK rows within the terminal width', () => {
    const wide = formatRepoList([{
      ...repo,
      full_name: '用户/仓库',
      language: '中文',
      description: '这是一段很长的中文仓库描述用来测试截断和折行是否按照显示宽度计算',
    }], { link: false, header: false, width: 40, now });

    expect(wide.split('\n').every((line) => displayWidth(line) <= 40)).toBe(true);
  });

  it('shows the updated time when sorting by update', () => {
    const text = formatRepoList([repo], { link: false, header: true, width: 80, now, time: 'updated' });
    expect(text.split('\n')[0]).toMatch(/UPDATED$/);
  });
});

describe('formatAge', () => {
  it('uses compact units sized for a narrow column', () => {
    expect(formatAge('2026-09-01T23:59:30Z', now)).toBe('now');
    expect(formatAge('2026-09-01T21:00:00Z', now)).toBe('3h');
    expect(formatAge('2026-08-26T00:00:00Z', now)).toBe('7d');
    expect(formatAge('2026-08-01T00:00:00Z', now)).toBe('4w');
    expect(formatAge('2026-01-01T00:00:00Z', now)).toBe('8mo');
    expect(formatAge('2023-01-01T00:00:00Z', now)).toBe('3y');
    expect(formatAge(null, now)).toBe('–');
  });
});

describe('formatRepoInfo', () => {
  it('keeps the ISO timestamp and adds a relative hint', () => {
    const text = stripAnsi(formatRepoInfo(repo, { link: false, now }));
    expect(text).toContain('Name:        user/repo');
    expect(text).toContain('Stars:       ★ 1.5k');
    expect(text).toContain('Topics:      #cli #typescript');
    expect(text).toContain('Starred at:  2026-01-01T00:00:00Z (8 months ago)');
  });
});

describe('highlightTerms', () => {
  const original = process.env.FORCE_COLOR;

  afterEach(() => {
    if (original === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = original;
  });

  it('emphasizes whole-word, case-insensitive matches when color is on', () => {
    process.env.FORCE_COLOR = '1';
    expect(highlightTerms('Terminal UI for terminals', queryTerms('terminal ui')))
      .toBe('\x1b[1;4mTerminal\x1b[0m \x1b[1;4mUI\x1b[0m for terminals');
  });

  it('skips matches inside ASCII words but not next to CJK or punctuation', () => {
    process.env.FORCE_COLOR = '1';
    expect(stripAnsi(highlightTerms('OpenAI AIlice', ['ai']))).toBe('OpenAI AIlice');
    expect(highlightTerms('使用ai生成', ['ai'])).toBe('使用\x1b[1;4mai\x1b[0m生成');
    expect(highlightTerms('AI-Startup', ['ai'])).toBe('\x1b[1;4mAI\x1b[0m-Startup');
  });

  it('treats query text literally and skips single characters', () => {
    process.env.FORCE_COLOR = '1';
    expect(queryTerms('c++ a  ui')).toEqual(['c++', 'ui']);
    expect(highlightTerms('fast c++ lib', ['c++'])).toBe('fast \x1b[1;4mc++\x1b[0m lib');
  });
});

describe('staleSyncHint', () => {
  it('nudges only after a week without syncing', () => {
    expect(staleSyncHint('2026-08-30T00:00:00Z', now)).toBeNull();
    expect(staleSyncHint(null, now)).toBeNull();
    expect(staleSyncHint('2026-07-01T00:00:00Z', now)).toContain('Last synced 2 months ago');
  });
});
