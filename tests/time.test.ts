import { describe, it, expect } from 'vitest';
import { resolveStarredTimeRange } from '../src/lib/time.js';

describe('resolveStarredTimeRange', () => {
  it('uses explicit since/until when provided', () => {
    const range = resolveStarredTimeRange({
      since: '2026-03-01',
      until: '2026-03-08',
    });
    expect(range.starredAfter).toBe('2026-03-01T00:00:00.000Z');
    expect(range.starredBefore).toBe('2026-03-08T00:00:00.000Z');
  });

  it('supports days as relative range', () => {
    const range = resolveStarredTimeRange(
      { days: 7 },
      new Date('2026-03-08T00:00:00.000Z')
    );
    expect(range.starredAfter).toBe('2026-03-01T00:00:00.000Z');
    expect(range.starredBefore).toBeUndefined();
  });

  it('throws on invalid date', () => {
    expect(() => resolveStarredTimeRange({ since: 'not-a-date' })).toThrow();
  });

  it('throws on invalid ordering', () => {
    expect(() =>
      resolveStarredTimeRange({
        since: '2026-03-09',
        until: '2026-03-01',
      })
    ).toThrow();
  });
});
