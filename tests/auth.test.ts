import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('runAuth', () => {
  it('reuses a valid stored token when force is not enabled', async () => {
    const saveToken = vi.fn();
    const createOctokit = vi.fn().mockReturnValue({ token: 'stored-token' });
    const getAuthenticatedUser = vi.fn().mockResolvedValue('alice');
    const runDeviceFlow = vi.fn();

    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue('stored-token'),
      saveToken,
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit,
      getAuthenticatedUser,
      runDeviceFlow,
    }));

    const { runAuth } = await import('../src/commands/auth.js');
    await expect(runAuth()).resolves.toBe('stored-token');

    expect(createOctokit).toHaveBeenCalledWith('stored-token');
    expect(getAuthenticatedUser).toHaveBeenCalledWith({ token: 'stored-token' });
    expect(runDeviceFlow).not.toHaveBeenCalled();
    expect(saveToken).not.toHaveBeenCalled();
  });

  it('starts device flow when forced even if a token exists', async () => {
    const saveToken = vi.fn();
    const runDeviceFlow = vi.fn().mockResolvedValue({ token: 'new-token' });

    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue('stored-token'),
      saveToken,
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn().mockReturnValue({ token: 'new-token' }),
      getAuthenticatedUser: vi.fn().mockResolvedValue('alice'),
      runDeviceFlow,
    }));

    const { runAuth } = await import('../src/commands/auth.js');
    await expect(runAuth({ force: true })).resolves.toBe('new-token');

    expect(runDeviceFlow).toHaveBeenCalledTimes(1);
    expect(saveToken).toHaveBeenCalledWith('new-token');
  });

  it('re-authenticates when a stored token is invalid', async () => {
    const saveToken = vi.fn();
    const runDeviceFlow = vi.fn().mockResolvedValue({ token: 'new-token' });
    const getAuthenticatedUser = vi.fn()
      .mockRejectedValueOnce(new Error('bad credentials'))
      .mockResolvedValueOnce('alice');

    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue('stored-token'),
      saveToken,
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn((token: string) => ({ token })),
      getAuthenticatedUser,
      runDeviceFlow,
    }));

    const { runAuth } = await import('../src/commands/auth.js');
    await expect(runAuth()).resolves.toBe('new-token');

    expect(runDeviceFlow).toHaveBeenCalledTimes(1);
    expect(saveToken).toHaveBeenCalledWith('new-token');
  });
});

describe('ensureAuth', () => {
  it('returns an existing token without starting auth', async () => {
    const runDeviceFlow = vi.fn();

    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue('stored-token'),
      saveToken: vi.fn(),
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn(),
      getAuthenticatedUser: vi.fn(),
      runDeviceFlow,
    }));

    const { ensureAuth } = await import('../src/commands/auth.js');
    await expect(ensureAuth()).resolves.toBe('stored-token');

    expect(runDeviceFlow).not.toHaveBeenCalled();
  });

  it('starts auth when no token exists', async () => {
    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue(null),
      saveToken: vi.fn(),
    }));
    vi.doMock('../src/lib/github.js', () => ({
      createOctokit: vi.fn().mockReturnValue({ token: 'new-token' }),
      getAuthenticatedUser: vi.fn().mockResolvedValue('alice'),
      runDeviceFlow: vi.fn().mockResolvedValue({ token: 'new-token' }),
    }));

    const { ensureAuth } = await import('../src/commands/auth.js');
    await expect(ensureAuth()).resolves.toBe('new-token');
  });

  it('logout clears a stored token and points to GitHub for revocation', async () => {
    const clearToken = vi.fn();
    const output: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });
    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue('stored-token'),
      getAuthFilePath: vi.fn().mockReturnValue('/tmp/starepo/auth.json'),
      clearToken,
      saveToken: vi.fn(),
    }));

    const { runLogout } = await import('../src/commands/auth.js');
    runLogout();

    expect(clearToken).toHaveBeenCalledTimes(1);
    expect(output.join('')).toContain('Logged out; removed the GitHub token from /tmp/starepo/auth.json');
    expect(output.join('')).toContain('https://github.com/settings/applications');
  });

  it('logout is a no-op when not logged in', async () => {
    const clearToken = vi.fn();
    const output: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });
    vi.doMock('../src/lib/config.js', () => ({
      getToken: vi.fn().mockReturnValue(null),
      getAuthFilePath: vi.fn(),
      clearToken,
      saveToken: vi.fn(),
    }));

    const { runLogout } = await import('../src/commands/auth.js');
    runLogout();

    expect(clearToken).not.toHaveBeenCalled();
    expect(output.join('')).toContain('Not logged in.');
  });
});
