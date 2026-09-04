const ESC = '\x1b';

const ANSI = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
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
  dim: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.dim, text, stream),
  red: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.red, text, stream),
  green: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.green, text, stream),
  yellow: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.yellow, text, stream),
  cyan: (text: string, stream?: NodeJS.WriteStream) => paint(ANSI.cyan, text, stream),
};

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

export interface ProgressLineInput {
  label: string;
  done: number;
  total?: number;
  elapsedMs: number;
  barWidth?: number;
  tty?: boolean;
}

export function formatProgressLine(input: ProgressLineInput): string {
  const { label, done, total, elapsedMs, barWidth = 20, tty = false } = input;
  if (total === undefined) return `${label} ${done}`;

  const pct = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
  const elapsedSec = elapsedMs / 1000;
  const rate = elapsedSec > 0.2 ? done / elapsedSec : 0;
  const remaining = rate > 0 ? Math.max(0, (total - done) / rate) : null;
  const suffix = remaining === null ? `${done}/${total} (${pct}%)` : `${done}/${total} (${pct}%) ${rate.toFixed(1)}/s ETA ${formatDuration(remaining)}`;

  if (!tty) return `${label} ${suffix}`;
  const fraction = total === 0 ? 1 : done / total;
  return `${label} ${formatBar(fraction, barWidth)} ${suffix}`;
}

export function writeBanner(message: string, stream: NodeJS.WriteStream = process.stderr): void {
  stream.write(`${message}\n`);
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
  stream?: NodeJS.WriteStream;
  now?: () => number;
  barWidth?: number;
}

export class Progress {
  private readonly stream: NodeJS.WriteStream;
  private readonly now: () => number;
  private readonly startedAt: number;
  private lastEmitAt = Number.NEGATIVE_INFINITY;
  private finished = false;

  constructor(private readonly options: ProgressOptions) {
    this.stream = options.stream ?? process.stderr;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  update(done: number): void {
    if (this.finished) return;
    const ts = this.now();
    const total = this.options.total;
    const complete = total !== undefined && done >= total;
    if (!this.stream.isTTY && !complete && ts - this.lastEmitAt < 1000) return;
    this.lastEmitAt = ts;
    writeProgressLine(this.stream, formatProgressLine({
      label: this.options.label,
      done,
      total,
      elapsedMs: ts - this.startedAt,
      barWidth: this.options.barWidth,
      tty: Boolean(this.stream.isTTY),
    }));
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.stream.isTTY) this.stream.write('\n');
  }
}
