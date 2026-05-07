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
});
