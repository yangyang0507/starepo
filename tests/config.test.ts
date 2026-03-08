import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Override XDG paths to use a temp directory for tests
let tmpDir: string;

function setupTempEnv() {
  tmpDir = mkdtempSync(join(tmpdir(), 'starepo-test-'));
  process.env.XDG_CONFIG_HOME = join(tmpDir, 'config');
  process.env.XDG_DATA_HOME = join(tmpDir, 'data');
}

function cleanupTempEnv() {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.XDG_DATA_HOME;
}

describe('config: token management', () => {
  beforeEach(() => {
    setupTempEnv();
    // Re-import config fresh so it picks up new env vars
    vi.resetModules();
  });
  afterEach(cleanupTempEnv);

  it('getToken returns null when no auth file exists', async () => {
    const { getToken } = await import('../src/lib/config.js');
    expect(getToken()).toBeNull();
  });

  it('saveToken and getToken round-trip', async () => {
    const { saveToken, getToken } = await import('../src/lib/config.js');
    saveToken('test-token-123');
    expect(getToken()).toBe('test-token-123');
  });

  it('clearToken makes getToken return null', async () => {
    const { saveToken, clearToken, getToken } = await import('../src/lib/config.js');
    saveToken('test-token-123');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('config: meta management', () => {
  beforeEach(() => {
    setupTempEnv();
    vi.resetModules();
  });
  afterEach(cleanupTempEnv);

  it('getMeta returns null for missing key', async () => {
    const { getMeta } = await import('../src/lib/config.js');
    expect(getMeta('last_sync')).toBeNull();
  });

  it('setMeta and getMeta round-trip', async () => {
    const { setMeta, getMeta } = await import('../src/lib/config.js');
    setMeta('last_sync', '2026-03-08T00:00:00.000Z');
    expect(getMeta('last_sync')).toBe('2026-03-08T00:00:00.000Z');
  });

  it('setMeta overwrites existing value', async () => {
    const { setMeta, getMeta } = await import('../src/lib/config.js');
    setMeta('last_sync', 'old');
    setMeta('last_sync', 'new');
    expect(getMeta('last_sync')).toBe('new');
  });

  it('multiple keys are independent', async () => {
    const { setMeta, getMeta } = await import('../src/lib/config.js');
    setMeta('key_a', 'value_a');
    setMeta('key_b', 'value_b');
    expect(getMeta('key_a')).toBe('value_a');
    expect(getMeta('key_b')).toBe('value_b');
  });
});
