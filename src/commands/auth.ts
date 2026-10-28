import { homedir } from 'os';
import { clearToken, getAuthFilePath, getToken, saveToken } from '../lib/config.js';
import { runDeviceFlow, createOctokit, getAuthenticatedUser } from '../lib/github.js';
import { note, style, success, warn } from '../lib/term.js';

export async function runAuth(options: { force?: boolean } = {}): Promise<string> {
  const existing = getToken();
  if (existing && !options.force) {
    try {
      const octokit = createOctokit(existing);
      const user = await getAuthenticatedUser(octokit);
      success(`Already authenticated as ${user}`);
      return existing;
    } catch {
      warn('Stored token is invalid, re-authenticating…');
    }
  }

  note('Starting GitHub authentication via Device Flow…');
  const { token } = await runDeviceFlow();
  saveToken(token);

  const octokit = createOctokit(token);
  const user = await getAuthenticatedUser(octokit);
  success(`Authenticated as ${user}`);

  return token;
}

export async function ensureAuth(): Promise<string> {
  const token = getToken();
  if (!token) {
    note('No authentication found. Starting GitHub login…');
    return runAuth();
  }
  return token;
}

/**
 * Forgets the local token. GitHub-side revocation needs the OAuth app's client
 * secret, which a device-flow CLI doesn't have, so point the user there instead.
 */
export function runLogout(): void {
  if (!getToken()) {
    note('Not logged in.');
    return;
  }
  clearToken();
  const path = getAuthFilePath().replace(homedir(), '~');
  success(`Logged out; removed the GitHub token from ${path}`);
  note(style.gray(
    '  Synced stars stay on this machine. To also revoke starepo\'s access on GitHub, ' +
    'visit https://github.com/settings/applications',
    process.stderr,
  ));
}
