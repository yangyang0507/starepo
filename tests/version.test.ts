import { describe, it, expect } from 'vitest';
import packageJson from '../package.json' assert { type: 'json' };
import { VERSION } from '../src/lib/version.js';

describe('version', () => {
  it('matches package.json version', () => {
    expect(VERSION).toBe(packageJson.version);
  });
});
