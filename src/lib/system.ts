import { spawn } from 'child_process';

type Command = [string, ...string[]];

/** Runs `command`, feeding it `input` on stdin; resolves false if it is missing or fails. */
function run([cmd, ...args]: Command, input?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: [input === undefined ? 'ignore' : 'pipe', 'ignore', 'ignore'],
      detached: input === undefined,
    });
    child.on('error', () => resolve(false));
    if (input === undefined) {
      // Browser launchers can outlive us; don't wait for them.
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
      return;
    }
    child.on('close', (code) => resolve(code === 0));
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

function openCommand(url: string, platform: NodeJS.Platform): Command {
  if (platform === 'darwin') return ['open', url];
  if (platform === 'win32') return ['cmd', '/c', 'start', '', url];
  return ['xdg-open', url];
}

export function openUrl(url: string, platform = process.platform): Promise<boolean> {
  return run(openCommand(url, platform));
}

function clipboardCommands(platform: NodeJS.Platform): Command[] {
  if (platform === 'darwin') return [['pbcopy']];
  if (platform === 'win32') return [['clip']];
  return [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']];
}

/**
 * Copies `text` with the platform clipboard tool, falling back to an OSC 52
 * escape, which many terminals (including over SSH) turn into a clipboard write.
 */
export async function copyToClipboard(
  text: string,
  options: { platform?: NodeJS.Platform; stream?: NodeJS.WriteStream } = {},
): Promise<boolean> {
  for (const command of clipboardCommands(options.platform ?? process.platform)) {
    if (await run(command, text)) return true;
  }
  const stream = options.stream ?? process.stdout;
  if (!stream.isTTY) return false;
  stream.write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`);
  return true;
}
