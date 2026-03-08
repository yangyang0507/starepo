export interface StarredTimeRangeInput {
  since?: string;
  until?: string;
  days?: number;
}

export interface StarredTimeRange {
  starredAfter?: string;
  starredBefore?: string;
}

function parseDateInput(value: string, label: 'since' | 'until'): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --${label} value: "${value}". Use ISO date format, e.g. 2026-03-01 or 2026-03-01T00:00:00Z.`);
  }
  return parsed;
}

export function resolveStarredTimeRange(
  input: StarredTimeRangeInput,
  now = new Date()
): StarredTimeRange {
  const { since, until, days } = input;

  const sinceDate = since ? parseDateInput(since, 'since') : null;
  const untilDate = until ? parseDateInput(until, 'until') : null;

  if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
    throw new Error(`Invalid --days value: "${days}". It must be a positive number.`);
  }

  const starredAfter = sinceDate
    ? sinceDate
    : days !== undefined
      ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      : null;

  const starredBefore = untilDate;

  if (starredAfter && starredBefore && starredAfter > starredBefore) {
    throw new Error('Invalid time range: --since/--days must be earlier than --until.');
  }

  return {
    starredAfter: starredAfter?.toISOString(),
    starredBefore: starredBefore?.toISOString(),
  };
}
