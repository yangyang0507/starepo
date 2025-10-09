export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

const logLevelState = { level: resolveLogLevel() };

export function getLogLevel(): LogLevel {
  return logLevelState.level;
}

export function setLogLevel(level: LogLevel): void {
  if (!(level in LEVEL_PRIORITY)) {
    throw new Error(`Invalid log level: ${level}`);
  }
  logLevelState.level = level;
}

interface LoggerOptions {
  scope?: string;
  levelRef?: { level: LogLevel };
}

export class Logger {
  private readonly scope?: string;
  private readonly levelRef: { level: LogLevel };

  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope;
    this.levelRef = options.levelRef ?? logLevelState;
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
    return new Logger({ scope: nestedScope, levelRef: this.levelRef });
  }

  private log(level: LogLevel, message: string, ...details: unknown[]): void {
    const activeLevel = this.levelRef.level;
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[activeLevel]) {
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
