import { spawn } from 'child_process';

const ESC = '\x1b';

const ANSI = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  // Bright black rather than SGR 2 "dim": many themes render dim identically to normal text.
  gray: `${ESC}[90m`,
  highlight: `${ESC}[1;4m`,
  red: `${ESC}[31m`,
  green: `${ESC}[32m`,
  yellow: `${ESC}[33m`,
  cyan: `${ESC}[36m`,
} as const;

export function isTTY(stream: NodeJS.WriteStream = process.stdout): boolean {
  return Boolean(stream.isTTY) && process.env.TERM !== 'dumb';
}

export function shouldUseColor(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env.FORCE_COLOR === '0') return false;
  if (typeof process.env.NO_COLOR === 'string') return false;
  if (process.env.FORCE_COLOR) return true;
  return isTTY(stream);
}

function paint(code: string, text: string, stream: NodeJS.WriteStream = process.stdout): string {
  if (!shouldUseColor(stream)) return text;
  return `${code}${text}${ANSI.reset}`;
}

export const style = {
  bold: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.bold, text, stream),
  gray: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.gray, text, stream),
  highlight: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.highlight, text, stream),
  red: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.red, text, stream),
  green: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.green, text, stream),
  yellow: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.yellow, text, stream),
  cyan: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.cyan, text, stream),
};

function supportsTrueColor(): boolean {
  return /^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? '');
}

/** Nearest xterm-256 palette index, for terminals without 24-bit color. */
function ansi256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const level = (v: number) => Math.round((v / 255) * 5);
  return 16 + 36 * level(r) + 6 * level(g) + level(b);
}

/** Colors `text` with a `#rrggbb` foreground. */
export function hex(color: string, text: string, stream: NodeJS.WriteStream = process.stdout): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return text;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  const code = supportsTrueColor() ? `${ESC}[38;2;${r};${g};${b}m` : `${ESC}[38;5;${ansi256(r, g, b)}m`;
  return paint(code, text, stream);
}

export function terminalWidth(stream: NodeJS.WriteStream = process.stdout): number {
  return stream.columns && stream.columns > 0 ? stream.columns : 80;
}

export function hyperlink(label: string, url: string, stream: NodeJS.WriteStream = process.stdout): string {
  if (!isTTY(stream) || !url) return label;
  return `${ESC}]8;;${url}${ESC}\\${label}${ESC}]8;;${ESC}\\`;
}

export function formatCount(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1000) return String(n);
  if (n < 10_000) {
    const scaled = n / 1000;
    const text = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${text.replace(/\.0$/, '')}k`;
  }
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  const millions = n / 1_000_000;
  const text = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1);
  return `${text.replace(/\.0$/, '')}m`;
}

export function formatRelativeTime(value: string | null | undefined, nowMs = Date.now()): string {
  if (!value) return 'unknown';
  const then = Date.parse(value);
  if (Number.isNaN(then)) return value;
  const seconds = Math.max(0, Math.round((nowMs - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 2) return '1 minute ago';
  if (minutes < 45) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 2) return '1 hour ago';
  if (hours < 36) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 2) return '1 day ago';
  if (days < 27) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 2) return '1 month ago';
  if (months < 18) return `${months} months ago`;
  const years = Math.round(days / 365);
  return years < 2 ? '1 year ago' : `${years} years ago`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatBar(fraction: number, width = 20): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  const filled = Math.round(clamped * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

const graphemeSegmenter = typeof Intl === 'object' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function graphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

function isZeroWidthCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036F) ||
    (cp >= 0x0483 && cp <= 0x0489) ||
    (cp >= 0x0591 && cp <= 0x05BD) ||
    (cp >= 0x0610 && cp <= 0x061A) ||
    (cp >= 0x064B && cp <= 0x065F) ||
    (cp >= 0x06D6 && cp <= 0x06ED) ||
    (cp >= 0x1160 && cp <= 0x11FF) ||
    (cp >= 0x1AB0 && cp <= 0x1AFF) ||
    (cp >= 0x1DC0 && cp <= 0x1DFF) ||
    (cp >= 0x20D0 && cp <= 0x20FF) ||
    (cp >= 0xFE00 && cp <= 0xFE0F) ||
    (cp >= 0xFE20 && cp <= 0xFE2F) ||
    (cp >= 0xE0100 && cp <= 0xE01EF) ||
    cp === 0x200B || cp === 0x200C || cp === 0x200D || cp === 0x2060 || cp === 0xFEFF
  );
}

function isWideCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115F) ||
    cp === 0x2329 || cp === 0x232A ||
    (cp >= 0x2E80 && cp <= 0x3247 && cp !== 0x303F) ||
    (cp >= 0x3250 && cp <= 0x4DBF) ||
    (cp >= 0x4E00 && cp <= 0xA4C6) ||
    (cp >= 0xA960 && cp <= 0xA97C) ||
    (cp >= 0xAC00 && cp <= 0xD7A3) ||
    (cp >= 0xF900 && cp <= 0xFAFF) ||
    (cp >= 0xFE10 && cp <= 0xFE19) ||
    (cp >= 0xFE30 && cp <= 0xFE6F) ||
    (cp >= 0xFF00 && cp <= 0xFF60) ||
    (cp >= 0xFFE0 && cp <= 0xFFE6) ||
    (cp >= 0x1B000 && cp <= 0x1B001) ||
    (cp >= 0x1F200 && cp <= 0x1F251) ||
    (cp >= 0x1F300 && cp <= 0x1F64F) ||
    (cp >= 0x1F900 && cp <= 0x1F9FF) ||
    (cp >= 0x1FA00 && cp <= 0x1FAFF) ||
    (cp >= 0x20000 && cp <= 0x3FFFD)
  );
}

function codePointWidth(cp: number): number {
  if (isZeroWidthCodePoint(cp)) return 0;
  return isWideCodePoint(cp) ? 2 : 1;
}

function graphemeWidth(grapheme: string): number {
  let max = 0;
  let emojiSequence = false;
  for (const char of grapheme) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0x200D || cp === 0xFE0F) emojiSequence = true;
    const width = codePointWidth(cp);
    if (width > max) max = width;
  }
  if (emojiSequence) return Math.max(max, 2);
  return max;
}

export function displayWidth(text: string): number {
  let width = 0;
  for (const grapheme of graphemes(text)) {
    width += graphemeWidth(grapheme);
  }
  return width;
}

export function truncate(text: string, width: number): string {
  if (width <= 0) return '';
  if (displayWidth(text) <= width) return text;
  if (width === 1) return '…';
  const budget = width - 1;
  let out = '';
  let used = 0;
  for (const grapheme of graphemes(text)) {
    const next = used + graphemeWidth(grapheme);
    if (next > budget) break;
    out += grapheme;
    used = next;
  }
  return `${out}…`;
}

export function formatBytes(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export type ProgressUnit = 'items' | 'bytes';

export function padEnd(text: string, width: number, visibleWidth = displayWidth(text)): string {
  return text + ' '.repeat(Math.max(0, width - visibleWidth));
}

export function padStart(text: string, width: number, visibleWidth = displayWidth(text)): string {
  return ' '.repeat(Math.max(0, width - visibleWidth)) + text;
}

/**
 * Word-wraps `text` to `width` display columns. Latin text breaks at spaces;
 * CJK and other wide characters may break between any two characters. Text
 * beyond `maxLines` is cut with an ellipsis on the last line.
 */
export function wrapText(text: string, width: number, maxLines = Number.POSITIVE_INFINITY): string[] {
  if (width <= 0) return [];
  const tokens = text.trim().split(/(\s+)/).flatMap((part) => {
    if (/^\s+$/.test(part)) return [' '];
    // Each wide grapheme is its own token so CJK runs can break anywhere.
    const out: string[] = [];
    let run = '';
    for (const grapheme of graphemes(part)) {
      if (graphemeWidth(grapheme) > 1) {
        if (run) out.push(run);
        out.push(grapheme);
        run = '';
      } else {
        run += grapheme;
      }
    }
    if (run) out.push(run);
    return out;
  });

  const lines: string[] = [];
  let line = '';
  let used = 0;
  let space = false;
  const push = () => {
    if (line) lines.push(line);
    line = '';
    used = 0;
  };

  for (const token of tokens) {
    if (token === ' ') {
      space = used > 0;
      continue;
    }
    const gap = space ? 1 : 0;
    const tokenWidth = displayWidth(token);
    space = false;
    if (used + gap + tokenWidth <= width) {
      line += (gap ? ' ' : '') + token;
      used += gap + tokenWidth;
      continue;
    }
    push();
    if (tokenWidth <= width) {
      line = token;
      used = tokenWidth;
      continue;
    }
    // A single word longer than the line (e.g. a URL): hard-break it.
    for (const grapheme of graphemes(token)) {
      const w = graphemeWidth(grapheme);
      if (used + w > width) push();
      line += grapheme;
      used += w;
    }
  }
  push();

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = truncate(`${kept[maxLines - 1]} ${lines[maxLines]}`, width);
  return kept;
}

export interface ProgressLineInput {
  label: string;
  done: number;
  total?: number;
  elapsedMs: number;
  barWidth?: number;
  tty?: boolean;
  unit?: ProgressUnit;
}

export function formatProgressLine(input: ProgressLineInput): string {
  const { label, done, total, elapsedMs, barWidth = 20, tty = false, unit = 'items' } = input;
  const amount = unit === 'bytes' ? formatBytes : String;
  if (total === undefined) return `${label} ${amount(done)}`;

  const pct = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
  const elapsedSec = elapsedMs / 1000;
  const rate = elapsedSec > 0.2 ? done / elapsedSec : 0;
  const remaining = rate > 0 ? Math.max(0, (total - done) / rate) : null;
  const counts = `${amount(done)}/${amount(total)} (${pct}%)`;
  const speed = unit === 'bytes' ? `${formatBytes(rate)}/s` : `${rate.toFixed(1)}/s`;
  const suffix = remaining === null ? counts : `${counts} ${speed} ETA ${formatDuration(remaining)}`;

  if (!tty) return `${label} ${suffix}`;
  const fraction = total === 0 ? 1 : done / total;
  return `${label} ${formatBar(fraction, barWidth)} ${suffix}`;
}

/** Writes a status line to stderr, keeping stdout for command results. */
export function note(message = ''): void {
  process.stderr.write(`${message}\n`);
}

export function success(message: string): void {
  note(`${style.green('✓', process.stderr)} ${message}`);
}

export function warn(message: string): void {
  note(`${style.yellow('!', process.stderr)} ${message}`);
}

const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

// A progress bar or spinner owns the cursor's row while it redraws. Track it so
// Ctrl+C ends that row and restores the cursor instead of leaving the shell
// prompt glued to a half-drawn line.
let liveStream: NodeJS.WriteStream | null = null;

function onInterrupt(): void {
  liveStream?.write(`${SHOW_CURSOR}\n`);
  process.exit(130);
}

function claimLine(stream: NodeJS.WriteStream): void {
  if (liveStream === stream) return;
  if (!liveStream) process.on('SIGINT', onInterrupt);
  liveStream = stream;
  stream.write(HIDE_CURSOR);
}

function releaseLine(stream: NodeJS.WriteStream): void {
  if (liveStream !== stream) return;
  liveStream = null;
  process.off('SIGINT', onInterrupt);
  stream.write(SHOW_CURSOR);
}

export function writeProgressLine(stream: NodeJS.WriteStream, line: string): void {
  const clipped = truncate(line, terminalWidth(stream));
  if (stream.isTTY) {
    stream.write(`\r${clipped}${ESC}[K`);
    return;
  }
  stream.write(`${clipped}\n`);
}

export interface ProgressOptions {
  label: string;
  total?: number;
  unit?: ProgressUnit;
  stream?: NodeJS.WriteStream;
  now?: () => number;
  barWidth?: number;
  /** Stay silent until the work has run this long, so fast operations print nothing. */
  delayMs?: number;
}

const TTY_REDRAW_INTERVAL_MS = 80;
const LOG_LINE_INTERVAL_MS = 1000;

export class Progress {
  private readonly stream: NodeJS.WriteStream;
  private readonly now: () => number;
  private readonly startedAt: number;
  private total: number | undefined;
  private lastEmitAt = Number.NEGATIVE_INFINITY;
  private rendered = false;
  private finished = false;

  constructor(private readonly options: ProgressOptions) {
    this.stream = options.stream ?? process.stderr;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
    this.total = options.total;
  }

  /** Records progress; `total` may be passed when it only becomes known (or exact) mid-run. */
  update(done: number, total?: number): void {
    if (this.finished) return;
    if (total !== undefined) this.total = total;
    const ts = this.now();
    if (ts - this.startedAt < (this.options.delayMs ?? 0)) return;
    const complete = this.total !== undefined && done >= this.total;
    const interval = this.stream.isTTY ? TTY_REDRAW_INTERVAL_MS : LOG_LINE_INTERVAL_MS;
    if (!complete && ts - this.lastEmitAt < interval) return;
    this.lastEmitAt = ts;
    if (this.stream.isTTY) claimLine(this.stream);
    this.rendered = true;
    writeProgressLine(this.stream, formatProgressLine({
      label: this.options.label,
      done,
      total: this.total,
      elapsedMs: ts - this.startedAt,
      barWidth: this.options.barWidth,
      tty: Boolean(this.stream.isTTY),
      unit: this.options.unit,
    }));
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.stream.isTTY && this.rendered) {
      this.stream.write('\n');
      releaseLine(this.stream);
    }
  }
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * A transient one-line activity indicator. On a TTY it animates and erases
 * itself when stopped; elsewhere it prints nothing, so logs only get the
 * optional final message.
 */
export class Spinner {
  private readonly stream: NodeJS.WriteStream;
  private timer: NodeJS.Timeout | null = null;
  private frame = 0;

  constructor(private text: string, options: { stream?: NodeJS.WriteStream } = {}) {
    this.stream = options.stream ?? process.stderr;
  }

  start(): this {
    if (!this.stream.isTTY || this.timer) return this;
    claimLine(this.stream);
    this.render();
    this.timer = setInterval(() => this.render(), TTY_REDRAW_INTERVAL_MS);
    this.timer.unref();
    return this;
  }

  update(text: string): void {
    this.text = text;
    if (this.timer) this.render();
  }

  stop(message?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.stream.write(`\r${ESC}[K`);
      releaseLine(this.stream);
    }
    if (message) this.stream.write(`${message}\n`);
  }

  private render(): void {
    const frame = style.cyan(SPINNER_FRAMES[this.frame++ % SPINNER_FRAMES.length], this.stream);
    const text = truncate(this.text, terminalWidth(this.stream) - 2);
    this.stream.write(`\r${frame} ${text}${ESC}[K`);
  }
}

// SGR colors plus OSC-8 hyperlink open/close sequences.
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]|${ESC}\\]8;;[^${ESC}]*${ESC}\\\\`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/** Rows `text` occupies on a terminal `columns` wide, counting soft wraps. */
export function screenRows(text: string, columns: number): number {
  return text.split('\n').reduce(
    (rows, line) => rows + Math.max(1, Math.ceil(displayWidth(stripAnsi(line)) / Math.max(1, columns))),
    0,
  );
}

export interface PageOptions {
  enabled?: boolean;
  stream?: NodeJS.WriteStream;
}

/**
 * Prints `text` to stdout, piping it through `$STAREPO_PAGER` / `$PAGER`
 * (default `less`) when it would scroll past one screen of an interactive
 * terminal. Mirrors git: `LESS=FRX` unless the user set their own.
 */
export async function writePaged(text: string, options: PageOptions = {}): Promise<void> {
  const stream = options.stream ?? process.stdout;
  const pager = process.env.STAREPO_PAGER ?? process.env.PAGER ?? 'less';
  const fits = screenRows(text, terminalWidth(stream)) < (stream.rows || 24) - 1;
  if (options.enabled === false || !isTTY(stream) || fits || pager === '' || pager === 'cat') {
    console.log(text);
    return;
  }

  // Ctrl+C belongs to the pager while it runs (less uses it to stop searches).
  const ignoreInterrupt = () => {};
  process.on('SIGINT', ignoreInterrupt);
  const shown = await new Promise<boolean>((resolve) => {
    const child = spawn(pager, {
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, LESS: process.env.LESS ?? 'FRX' },
    });
    child.on('error', () => resolve(false));
    // 127: the shell could not find the pager command.
    child.on('close', (code) => resolve(code !== 127));
    // Quitting the pager early closes its stdin; that is not an error.
    child.stdin.on('error', () => {});
    child.stdin.end(`${text}\n`);
  }).finally(() => process.off('SIGINT', ignoreInterrupt));
  if (!shown) console.log(text);
}
