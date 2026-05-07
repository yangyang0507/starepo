import { Octokit } from '@octokit/rest';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { RepoInput } from './storage.js';

// GitHub OAuth App client ID for device flow (public, non-secret)
const GITHUB_CLIENT_ID = 'Ov23liAWejDY5000tT9s';

export function createOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, options: { method: string; url: string }, _octokit: Octokit, retryCount: number) => {
        console.warn(`Rate limit hit for ${options.method} ${options.url}. Waiting ${retryAfter}s...`);
        return retryCount < 2;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: { method: string; url: string }) => {
        console.warn(`Secondary rate limit for ${options.method} ${options.url}`);
        return false;
      },
    },
  });
}

export interface DeviceFlowResult {
  token: string;
}

interface StarredRepoItem {
  repo: {
    id: number;
    full_name: string;
    name: string;
    description: string | null;
    html_url: string;
    homepage: string | null;
    language: string | null;
    topics?: string[];
    stargazers_count: number;
    forks_count: number;
    updated_at: string | null;
  };
  starred_at?: string;
}

export async function runDeviceFlow(): Promise<DeviceFlowResult> {
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId: GITHUB_CLIENT_ID,
    scopes: ['read:user'],
    onVerification(verification) {
      console.log('\nTo authenticate with GitHub:');
      console.log(`  1. Open: ${verification.verification_uri}`);
      console.log(`  2. Enter code: ${verification.user_code}`);
      console.log(`\nWaiting for authorization (expires in ${Math.round(verification.expires_in / 60)} minutes)...`);
    },
  });

  const result = await auth({ type: 'oauth' });
  return { token: result.token };
}

function mapToRepoInput(item: StarredRepoItem): RepoInput {
  return {
    id: item.repo.id,
    full_name: item.repo.full_name,
    name: item.repo.name,
    description: item.repo.description ?? '',
    html_url: item.repo.html_url,
    homepage: item.repo.homepage ?? '',
    language: item.repo.language ?? '',
    topics: item.repo.topics ?? [],
    stars_count: item.repo.stargazers_count,
    forks_count: item.repo.forks_count,
    starred_at: item.starred_at ?? '',
    updated_at: item.repo.updated_at ?? '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStarredRepoItem(value: unknown): value is StarredRepoItem {
  if (!isRecord(value) || !isRecord(value.repo)) return false;
  const { repo } = value;

  return (
    typeof repo.id === 'number' &&
    typeof repo.full_name === 'string' &&
    typeof repo.name === 'string' &&
    isNullableString(repo.description) &&
    typeof repo.html_url === 'string' &&
    isNullableString(repo.homepage) &&
    isNullableString(repo.language) &&
    (repo.topics === undefined || isStringArray(repo.topics)) &&
    typeof repo.stargazers_count === 'number' &&
    typeof repo.forks_count === 'number' &&
    isNullableString(repo.updated_at) &&
    (value.starred_at === undefined || typeof value.starred_at === 'string')
  );
}

function starredResponseItems(data: unknown): StarredRepoItem[] {
  if (!Array.isArray(data) || !data.every(isStarredRepoItem)) {
    throw new Error('Unexpected GitHub starred repository response. Expected application/vnd.github.star+json items.');
  }
  return data;
}

export async function fetchAllStars(
  octokit: Octokit,
  onPage?: (count: number, total: number) => void
): Promise<RepoInput[]> {
  const results: RepoInput[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100, headers: { Accept: 'application/vnd.github.star+json' } }
  )) {
    const items = starredResponseItems(response.data);
    results.push(...items.map(mapToRepoInput));
    onPage?.(results.length, -1);
  }

  return results;
}

export async function fetchStarsSince(
  octokit: Octokit,
  since: Date,
  onPage?: (count: number) => void
): Promise<RepoInput[]> {
  const results: RepoInput[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100, sort: 'created', direction: 'desc', headers: { Accept: 'application/vnd.github.star+json' } }
  )) {
    const items = starredResponseItems(response.data);
    let done = false;

    for (const item of items) {
      const starredAt = item.starred_at ? new Date(item.starred_at) : null;
      if (starredAt && starredAt < since) {
        done = true;
        break;
      }
      results.push(mapToRepoInput(item));
    }

    onPage?.(results.length);
    if (done) break;
  }

  return results;
}

export async function getAuthenticatedUser(octokit: Octokit): Promise<string> {
  const { data } = await octokit.users.getAuthenticated();
  return data.login;
}
