import { describe, expect, it } from 'vitest';
import { formatRepo, formatRepoInfo, parseTopics } from '../src/lib/format.js';
import type { Repo } from '../src/lib/storage.js';
import { displayWidth } from '../src/lib/term.js';

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

describe('formatRepo', () => {
  it('renders a multi-line card with compact counts and relative time', () => {
    const text = formatRepo(repo, { index: 0, link: false, now });
    expect(text).toContain('1. user/repo [TypeScript]');
    expect(text).toContain('A useful repo');
    expect(text).toContain('https://github.com/user/repo');
    expect(text).toContain('stars 1.5k');
    expect(text).toContain('forks 2');
    expect(text).toContain('starred 8 months ago');
    expect(text).toContain('Topics: cli, typescript');
  });

  it('renders a single-line summary', () => {
    const text = formatRepo(repo, { index: 0, oneline: true, link: false, width: 80, now });
    expect(text.startsWith('1. user/repo [TypeScript]')).toBe(true);
    expect(text).toContain('★1.5k');
    expect(text).toContain('A useful repo');
    expect(text).not.toContain('\n');
  });

  it('budgets --oneline description using display width so CJK does not overflow', () => {
    const wide = formatRepo({
      ...repo,
      full_name: '用户/仓库',
      language: '中文',
      description: '这是一段很长的中文仓库描述用来测试截断',
    }, { index: 0, oneline: true, link: false, width: 40, now });

    expect(wide).not.toContain('\n');
    expect(displayWidth(wide)).toBeLessThanOrEqual(40);
  });
});

describe('formatRepoInfo', () => {
  it('keeps the ISO timestamp and adds a relative hint', () => {
    const text = formatRepoInfo(repo, { link: false, now });
    expect(text).toContain('Name:        user/repo');
    expect(text).toContain('Stars:       1.5k');
    expect(text).toContain('Starred at:  2026-01-01T00:00:00Z (8 months ago)');
  });
});
