import { getToken, saveToken } from '../lib/config.js';
import { runDeviceFlow, createOctokit, getAuthenticatedUser } from '../lib/github.js';
import { note, success, warn } from '../lib/term.js';

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
