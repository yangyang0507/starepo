import { emitKeypressEvents, type Interface } from 'readline';
import { muteStatus } from '../lib/term.js';
import type { Key } from './state.js';
import type { Frame } from './view.js';

const ESC = '\x1b';
const ENTER_ALT_SCREEN = `${ESC}[?1049h`;
const LEAVE_ALT_SCREEN = `${ESC}[?1049l`;
const NO_WRAP = `${ESC}[?7l`;
const WRAP = `${ESC}[?7h`;
const SHOW_CURSOR = `${ESC}[?25h`;
const HIDE_CURSOR = `${ESC}[?25l`;
// Terminals that support synchronized output paint the whole frame at once.
const BEGIN_FRAME = `${ESC}[?2026h`;
const END_FRAME = `${ESC}[?2026l`;

export interface Screen {
  readonly width: number;
  readonly height: number;
  render(frame: Frame): void;
  onKey(handler: (text: string | undefined, key: Key) => void): void;
  onResize(handler: () => void): void;
  close(): void;
}

/**
 * Takes over the terminal: alternate screen, raw keyboard input, and
 * line-diffed redraws. Anything else written to stderr meanwhile is held back
 * and printed after `close()`, so stray warnings can't corrupt the frame.
 */
export function openScreen(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): Screen {
  let previous: string[] = [];
  let closed = false;
  const keyHandlers: Array<(text: string | undefined, key: Key) => void> = [];
  const resizeHandlers: Array<() => void> = [];

  const heldStderr: string[] = [];
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    heldStderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stderr.write;
  muteStatus(true);

  const onKeypress = (text: string | undefined, key: Key | undefined) => {
    for (const handler of keyHandlers) handler(text, key ?? { sequence: text });
  };
  const onResize = () => {
    previous = [];
    output.write(`${ESC}[2J`);
    for (const handler of resizeHandlers) handler();
  };

  // Node waits 500ms after a lone ESC in case an escape sequence follows; that
  // makes Esc feel sluggish and merges a quick double-tap into one Meta-Esc.
  // Escape sequences from a local terminal arrive within a few milliseconds.
  // The typings ask for a full readline.Interface, but only this option is read.
  emitKeypressEvents(input, { escapeCodeTimeout: 50 } as unknown as Interface);
  input.setRawMode(true);
  input.resume();
  input.on('keypress', onKeypress);
  output.on('resize', onResize);
  output.write(`${ENTER_ALT_SCREEN}${NO_WRAP}${ESC}[2J`);

  const close = () => {
    if (closed) return;
    closed = true;
    process.off('exit', close);
    input.off('keypress', onKeypress);
    output.off('resize', onResize);
    input.setRawMode(false);
    input.pause();
    output.write(`${WRAP}${SHOW_CURSOR}${LEAVE_ALT_SCREEN}`);
    process.stderr.write = stderrWrite;
    muteStatus(false);
    if (heldStderr.length > 0) process.stderr.write(heldStderr.join(''));
  };
  // Restore the terminal even if something throws past the caller.
  process.once('exit', close);

  return {
    get width() {
      return output.columns || 80;
    },
    get height() {
      return output.rows || 24;
    },
    render(frame) {
      if (closed) return;
      let out = BEGIN_FRAME + HIDE_CURSOR;
      const rows = Math.max(frame.lines.length, previous.length);
      for (let row = 0; row < rows; row++) {
        const line = frame.lines[row] ?? '';
        if (line === previous[row]) continue;
        out += `${ESC}[${row + 1};1H${line}${ESC}[0m${ESC}[K`;
      }
      previous = frame.lines;
      out += `${ESC}[${frame.cursor.row + 1};${frame.cursor.col + 1}H${SHOW_CURSOR}${END_FRAME}`;
      output.write(out);
    },
    onKey(handler) {
      keyHandlers.push(handler);
    },
    onResize(handler) {
      resizeHandlers.push(handler);
    },
    close,
  };
}
