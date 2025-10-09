type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LEVEL_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  debug: 'log',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

function resolveLogLevel(): LogLevel {
  const envLevel = (process.env.STAREPO_LOG_LEVEL || '').toLowerCase() as LogLevel;
  if (envLevel && envLevel in LEVEL_PRIORITY) {
    return envLevel;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? 'info' : 'debug';
}

const baseLevel = resolveLogLevel();

interface LoggerOptions {
  scope?: string;
  level?: LogLevel;
}

export class Logger {
  private readonly scope?: string;
  private readonly level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope;
    this.level = options.level ?? baseLevel;
  }

  debug(message: string, ...details: unknown[]): void {
    this.log('debug', message, ...details);
  }

  info(message: string, ...details: unknown[]): void {
    this.log('info', message, ...details);
  }

  warn(message: string, ...details: unknown[]): void {
    this.log('warn', message, ...details);
  }

  error(message: string, ...details: unknown[]): void {
    this.log('error', message, ...details);
  }

  child(scope: string): Logger {
    const nestedScope = this.scope ? `${this.scope}:${scope}` : scope;
    return new Logger({ scope: nestedScope, level: this.level });
  }

  private log(level: LogLevel, message: string, ...details: unknown[]): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.scope ? `[${timestamp}] [${level.toUpperCase()}] [${this.scope}]` : `[${timestamp}] [${level.toUpperCase()}]`;
    const method = LEVEL_METHOD[level];

    if (details.length > 0) {
      console[method](prefix, message, ...details);
    } else {
      console[method](prefix, message);
    }
  }
}

export const logger = new Logger({ scope: 'main' });

export function getLogger(scope: string): Logger {
  return logger.child(scope);
}
