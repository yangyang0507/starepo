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

function mapToRepoInput(item: {
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
}): RepoInput {
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

export async function fetchAllStars(
  octokit: Octokit,
  onPage?: (count: number, total: number) => void
): Promise<RepoInput[]> {
  const results: RepoInput[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100, headers: { Accept: 'application/vnd.github.star+json' } }
  )) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = response.data as any as Array<Parameters<typeof mapToRepoInput>[0]>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = response.data as any as Array<Parameters<typeof mapToRepoInput>[0]>;
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
