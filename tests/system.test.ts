import { describe, expect, it } from 'vitest';
import { copyToClipboard, openCommand } from '../src/lib/system.js';

function fakeStream(isTTY: boolean) {
  const chunks: string[] = [];
  const stream = {
    isTTY,
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  } as unknown as NodeJS.WriteStream;
  return { stream, chunks };
}

describe('openCommand', () => {
  it('uses each platform\'s URL launcher', () => {
    const url = 'https://github.com/a/b';
    expect(openCommand(url, 'darwin')).toEqual(['open', url]);
    expect(openCommand(url, 'linux')).toEqual(['xdg-open', url]);
    expect(openCommand(url, 'win32')).toEqual(['cmd', '/c', 'start', '', url]);
  });
});

describe('copyToClipboard', () => {
  it('stops at the first clipboard tool that succeeds', async () => {
    const { stream, chunks } = fakeStream(true);
    await expect(copyToClipboard('text', {
      stream,
      commands: [['starepo-missing-clipboard-tool'], ['cat']],
    })).resolves.toBe(true);
    expect(chunks).toEqual([]);
  });

  it('falls back to an OSC 52 escape on a terminal', async () => {
    const { stream, chunks } = fakeStream(true);
    await expect(copyToClipboard('hi', { stream, commands: [['starepo-missing-clipboard-tool']] })).resolves.toBe(true);
    expect(chunks).toEqual([`\x1b]52;c;${Buffer.from('hi').toString('base64')}\x07`]);
  });

  it('reports failure when no tool works and there is no terminal', async () => {
    const { stream } = fakeStream(false);
    await expect(copyToClipboard('hi', { stream, commands: [['starepo-missing-clipboard-tool']] })).resolves.toBe(false);
  });
});
