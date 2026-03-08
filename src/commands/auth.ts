import { getToken, saveToken } from '../lib/config.js';
import { runDeviceFlow, createOctokit, getAuthenticatedUser } from '../lib/github.js';

export async function runAuth(options: { force?: boolean } = {}): Promise<string> {
  const existing = getToken();
  if (existing && !options.force) {
    try {
      const octokit = createOctokit(existing);
      const user = await getAuthenticatedUser(octokit);
      console.log(`Already authenticated as: ${user}`);
      return existing;
    } catch {
      console.log('Stored token is invalid, re-authenticating...');
    }
  }

  console.log('Starting GitHub authentication via Device Flow...');
  const { token } = await runDeviceFlow();
  saveToken(token);

  const octokit = createOctokit(token);
  const user = await getAuthenticatedUser(octokit);
  console.log(`\nAuthenticated successfully as: ${user}`);

  return token;
}

export async function ensureAuth(): Promise<string> {
  const token = getToken();
  if (!token) {
    console.log('No authentication found. Starting GitHub login...\n');
    return runAuth();
  }
  return token;
}
