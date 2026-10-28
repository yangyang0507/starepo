import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  displayWidth,
  formatBar,
  formatBytes,
  formatCount,
  formatDuration,
  formatProgressLine,
  formatRelativeTime,
  hyperlink,
  Progress,
  screenRows,
  shouldUseColor,
  Spinner,
  stripAnsi,
  truncate,
  wrapText,
  writePaged,
  writeProgressLine,
} from '../src/lib/term.js';

describe('shouldUseColor', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.NO_COLOR = original.NO_COLOR;
    process.env.FORCE_COLOR = original.FORCE_COLOR;
    if (original.NO_COLOR === undefined) delete process.env.NO_COLOR;
    if (original.FORCE_COLOR === undefined) delete process.env.FORCE_COLOR;
  });

  it('disables color when NO_COLOR is set', () => {
    process.env.NO_COLOR = '';
    delete process.env.FORCE_COLOR;
    expect(shouldUseColor({ isTTY: true } as NodeJS.WriteStream)).toBe(false);
  });

  it('enables color when FORCE_COLOR is set', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    expect(shouldUseColor({ isTTY: false } as NodeJS.WriteStream)).toBe(true);
  });
});

describe('formatCount', () => {
  it('uses compact suffixes past 999', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(1530)).toBe('1.5k');
    expect(formatCount(12345)).toBe('12k');
    expect(formatCount(1_200_000)).toBe('1.2m');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-09-02T00:00:00Z');

  it('describes recent and older timestamps', () => {
    expect(formatRelativeTime('2026-09-01T23:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-09-01T12:00:00Z', now)).toBe('12 hours ago');
    expect(formatRelativeTime('2026-01-01T00:00:00Z', now)).toBe('8 months ago');
    expect(formatRelativeTime(null, now)).toBe('unknown');
  });
});

describe('formatDuration', () => {
  it('renders compact remaining time', () => {
    expect(formatDuration(0.4)).toBe('<1s');
    expect(formatDuration(12)).toBe('12s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3600)).toBe('1h');
  });
});

describe('formatBar / truncate / progress', () => {
  it('fills a fixed-width bar', () => {
    expect(formatBar(0, 4)).toBe('░░░░');
    expect(formatBar(0.5, 4)).toBe('██░░');
    expect(formatBar(1, 4)).toBe('████');
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
    expect(truncate('short', 10)).toBe('short');
  });

  it('measures CJK and emoji by display columns, not string length', () => {
    expect(displayWidth('你好')).toBe(4);
    expect(displayWidth('👍')).toBe(2);
    expect('👍'.length).toBe(2);
    expect(truncate('你好世界', 5)).toBe('你好…');
    expect(truncate('👍👍👍', 5)).toBe('👍👍…');
    expect(truncate('a👍b', 3)).toBe('a…');
  });

  it('clips TTY progress writes to the stream width so \\r can clear the line', () => {
    const chunks: string[] = [];
    const stream = {
      isTTY: true,
      columns: 12,
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    writeProgressLine(stream, 'Embedding ████████ 50/100 (50%) 5.0/s ETA 10s');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startsWith('\r')).toBe(true);
    expect(chunks[0].endsWith('\x1b[K')).toBe(true);
    expect(displayWidth(chunks[0].slice(1, -3))).toBeLessThanOrEqual(12);
  });

  it('includes a bar and ETA for TTY progress with a known total', () => {
    const line = formatProgressLine({
      label: 'Embedding',
      done: 50,
      total: 100,
      elapsedMs: 10_000,
      barWidth: 4,
      tty: true,
    });
    expect(line).toContain('Embedding');
    expect(line).toContain('██░░');
    expect(line).toContain('50/100 (50%)');
    expect(line).toContain('5.0/s');
    expect(line).toContain('ETA 10s');
  });

  it('omits the bar when the total is unknown', () => {
    expect(formatProgressLine({
      label: 'Fetched',
      done: 12,
      elapsedMs: 1000,
      tty: true,
    })).toBe('Fetched 12');
  });
});

describe('hyperlink', () => {
  it('returns the plain label when the stream is not a TTY', () => {
    expect(hyperlink('user/repo', 'https://github.com/user/repo', { isTTY: false } as NodeJS.WriteStream)).toBe('user/repo');
  });
});

describe('Progress', () => {
  it('writes non-TTY updates as whole lines', () => {
    const chunks: string[] = [];
    const stream = {
      isTTY: false,
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    let now = 0;
    const progress = new Progress({
      label: 'Embedding',
      total: 2,
      stream,
      now: () => now,
    });
    progress.update(1);
    now = 2000;
    progress.update(2);
    progress.finish();

    expect(chunks.some((chunk) => chunk.includes('1/2'))).toBe(true);
    expect(chunks.at(-1)).toContain('2/2');
    expect(chunks.every((chunk) => chunk.endsWith('\n'))).toBe(true);
  });
});

function fakeStream(isTTY: boolean) {
  const chunks: string[] = [];
  const stream = {
    isTTY,
    columns: 80,
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  } as unknown as NodeJS.WriteStream;
  return { stream, chunks };
}

describe('formatBytes', () => {
  it('scales to binary units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(586_779_294)).toBe('560 MB');
  });

  it('formats byte progress lines with byte rates', () => {
    const line = formatProgressLine({
      label: 'Downloading',
      done: 100 * 1024 * 1024,
      total: 400 * 1024 * 1024,
      elapsedMs: 10_000,
      unit: 'bytes',
    });
    expect(line).toBe('Downloading 100 MB/400 MB (25%) 10.0 MB/s ETA 30s');
  });
});

describe('Progress on a TTY', () => {
  it('throttles redraws but always draws completion', () => {
    const { stream, chunks } = fakeStream(true);
    let now = 0;
    const progress = new Progress({ label: 'Embedding', total: 100, stream, now: () => now });

    for (let done = 1; done < 100; done++) {
      now = done; // 1ms apart: far faster than a terminal can usefully show
      progress.update(done);
    }
    now = 100;
    progress.update(100);
    progress.finish();

    const redraws = chunks.filter((chunk) => chunk.startsWith('\r'));
    expect(redraws.length).toBeLessThanOrEqual(3);
    expect(redraws.at(-1)).toContain('100/100');
  });

  it('stays silent when the work finishes inside delayMs', () => {
    const { stream, chunks } = fakeStream(true);
    let now = 0;
    const progress = new Progress({ label: 'Loading', total: 10, stream, now: () => now, delayMs: 500 });

    now = 100;
    progress.update(10);
    progress.finish();

    expect(chunks).toEqual([]);
  });

  it('accepts a total discovered mid-run', () => {
    const { stream, chunks } = fakeStream(false);
    const progress = new Progress({ label: 'Fetching stars', stream });

    progress.update(100, 300);
    progress.update(250, 250);

    expect(chunks[0]).toContain('100/300');
    expect(chunks.at(-1)).toContain('250/250 (100%)');
  });
});

describe('Spinner', () => {
  it('prints only the final message when not on a TTY', () => {
    const { stream, chunks } = fakeStream(false);
    const spinner = new Spinner('Saving…', { stream }).start();
    spinner.stop('done');
    expect(chunks).toEqual(['done\n']);
  });

  it('erases itself and restores the cursor on a TTY', () => {
    const { stream, chunks } = fakeStream(true);
    const spinner = new Spinner('Saving…', { stream }).start();
    spinner.stop();

    expect(chunks.join('')).toContain('Saving…');
    expect(chunks.at(-1)).toBe('\x1b[?25h');
  });
});

describe('paging', () => {
  it('strips colors and OSC-8 links before measuring', () => {
    const line = '\x1b[1m\x1b]8;;https://github.com/a/b\x1b\\a/b\x1b]8;;\x1b\\\x1b[0m [\x1b[36mRust\x1b[0m]';
    expect(stripAnsi(line)).toBe('a/b [Rust]');
  });

  it('counts soft-wrapped rows', () => {
    expect(screenRows('short\n' + 'x'.repeat(25), 10)).toBe(4);
  });

  it('prints directly when output is not a terminal', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stream = { isTTY: false, rows: 2, columns: 80 } as unknown as NodeJS.WriteStream;

    await writePaged('a\nb\nc\nd', { stream });

    expect(log).toHaveBeenCalledWith('a\nb\nc\nd');
    log.mockRestore();
  });

  it('prints directly when paging is disabled, even on a short terminal', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stream = { isTTY: true, rows: 2, columns: 80 } as unknown as NodeJS.WriteStream;

    await writePaged('a\nb\nc\nd', { stream, enabled: false });

    expect(log).toHaveBeenCalledWith('a\nb\nc\nd');
    log.mockRestore();
  });
});

describe('wrapText', () => {
  it('breaks Latin text at spaces', () => {
    expect(wrapText('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
  });

  it('breaks CJK anywhere and keeps mixed runs within the width', () => {
    const lines = wrapText('使用ai生成多章节的长篇小说', 10);
    expect(lines).toEqual(['使用ai生成', '多章节的长', '篇小说']);
    expect(lines.every((line) => displayWidth(line) <= 10)).toBe(true);
  });

  it('hard-breaks words longer than the line', () => {
    expect(wrapText('see https://example.com/very/long', 10)).toEqual(['see', 'https://ex', 'ample.com/', 'very/long']);
  });

  it('ellipsizes the last kept line', () => {
    expect(wrapText('one two three four five six', 9, 2)).toEqual(['one two', 'three fo…']);
  });
});
