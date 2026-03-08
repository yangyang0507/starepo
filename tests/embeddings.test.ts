import { describe, it, expect } from 'vitest';
import { repoToText } from '../src/lib/embeddings.js';

const baseRepo = {
  name: 'awesome-lib',
  full_name: 'user/awesome-lib',
  description: 'An awesome library',
  topics: '["react","typescript"]',
  language: 'TypeScript',
};

describe('repoToText', () => {
  it('concatenates all fields', () => {
    const text = repoToText(baseRepo);
    expect(text).toContain('awesome-lib');
    expect(text).toContain('user/awesome-lib');
    expect(text).toContain('An awesome library');
    expect(text).toContain('react');
    expect(text).toContain('typescript');
    expect(text).toContain('TypeScript');
  });

  it('handles empty description', () => {
    const text = repoToText({ ...baseRepo, description: '' });
    expect(text).toContain('awesome-lib');
    expect(text).not.toContain('  '); // no double spaces from empty field
  });

  it('handles empty language', () => {
    const text = repoToText({ ...baseRepo, language: '' });
    expect(text).toContain('awesome-lib');
  });

  it('handles malformed topics JSON gracefully', () => {
    const text = repoToText({ ...baseRepo, topics: 'not-json' });
    expect(text).toContain('not-json');
  });

  it('handles empty topics array', () => {
    const text = repoToText({ ...baseRepo, topics: '[]' });
    expect(text).toContain('awesome-lib');
    expect(text).toContain('An awesome library');
  });

  it('joins topics with spaces', () => {
    const text = repoToText({ ...baseRepo, topics: '["ai","ml","python"]' });
    expect(text).toContain('ai ml python');
  });
});
