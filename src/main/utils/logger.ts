import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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

// 日志配置接口
export interface LogConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  maxFileSize: number; // MB
  maxFiles: number;
  logDir: string;
  enableStructuredLogging: boolean;
}

// 默认日志配置
const DEFAULT_CONFIG: LogConfig = {
  level: 'info',
  enableFileLogging: true,
  maxFileSize: 10, // 10MB
  maxFiles: 5,
  logDir: path.join(os.homedir(), '.starepo', 'logs'),
  enableStructuredLogging: false,
};

function resolveLogLevel(): LogLevel {
  const envLevel = (process.env.STAREPO_LOG_LEVEL || '').toLowerCase() as LogLevel;
  if (envLevel && envLevel in LEVEL_PRIORITY) {
    return envLevel;
  }

  // 桌面应用日志级别配置
  // 生产环境只记录 warn 和 error，减少日志噪音
  // 开发环境默认记录 info 级别，提供有用的调试信息
  // 可通过环境变量 STAREPO_LOG_LEVEL=debug 开启更详细的日志
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? 'warn' : 'info';
}

// 日志配置状态
const logConfigState = {
  level: resolveLogLevel(),
  config: { ...DEFAULT_CONFIG }
};

export function getLogLevel(): LogLevel {
  return logConfigState.level;
}

export function setLogLevel(level: LogLevel): void {
  if (!(level in LEVEL_PRIORITY)) {
    throw new Error(`Invalid log level: ${level}`);
  }
  logConfigState.level = level;
}

export function getLogConfig(): LogConfig {
  return { ...logConfigState.config };
}

export function setLogConfig(config: Partial<LogConfig>): void {
  logConfigState.config = { ...logConfigState.config, ...config };
}

// 文件日志管理器
class FileLogManager {
  private static instance: FileLogManager;
  private currentLogFile: string | null = null;
  private writeQueue: Array<{ message: string; timestamp: number }> = [];
  private isWriting = false;
  private initialized = false;

  static getInstance(): FileLogManager {
    if (!FileLogManager.instance) {
      FileLogManager.instance = new FileLogManager();
    }
    return FileLogManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(logConfigState.config.logDir, { recursive: true });
      await this.rotateLogIfNeeded();
      this.initialized = true;
    } catch (error) {
      console.error('[Logger] Failed to initialize file logging:', error);
    }
  }

  private async getCurrentLogFile(): Promise<string> {
    if (!this.currentLogFile) {
      const today = new Date().toISOString().split('T')[0];
      this.currentLogFile = path.join(logConfigState.config.logDir, `starepo-${today}.log`);
    }
    return this.currentLogFile;
  }

  private async rotateLogIfNeeded(): Promise<void> {
    if (!logConfigState.config.enableFileLogging) return;

    try {
      const currentFile = await this.getCurrentLogFile();

      // 检查文件大小
      const stats = await fs.stat(currentFile).catch(() => null);
      if (stats && stats.size > logConfigState.config.maxFileSize * 1024 * 1024) {
        // 轮转日志文件
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = currentFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(currentFile, rotatedFile);

        // 清理旧日志文件
        await this.cleanOldLogs();
      }
    } catch (error) {
      console.error('[Logger] Log rotation failed:', error);
    }
  }

  private async cleanOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(logConfigState.config.logDir);
      const logFiles = files
        .filter(file => file.startsWith('starepo-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logConfigState.config.logDir, file),
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // 按文件名降序排列

      // 保留最新的 maxFiles 个文件
      if (logFiles.length > logConfigState.config.maxFiles) {
        const filesToDelete = logFiles.slice(logConfigState.config.maxFiles);
        await Promise.all(filesToDelete.map(file =>
          fs.unlink(file.path).catch(err =>
            console.error('[Logger] Failed to delete old log file:', file.path, err)
          )
        ));
      }
    } catch (error) {
      console.error('[Logger] Failed to clean old logs:', error);
    }
  }

  async writeLog(message: string): Promise<void> {
    if (!logConfigState.config.enableFileLogging) return;

    this.writeQueue.push({ message, timestamp: Date.now() });

    if (!this.isWriting) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.writeQueue.length === 0) {
      this.isWriting = false;
      return;
    }

    this.isWriting = true;

    try {
      await this.initialize();
      await this.rotateLogIfNeeded();

      const currentFile = await this.getCurrentLogFile();
      const messages = this.writeQueue.splice(0);

      // 批量写入
      const content = messages.map(item => item.message).join('\n') + '\n';
      await fs.appendFile(currentFile, content, { encoding: 'utf8' });
    } catch (error) {
      console.error('[Logger] Failed to write logs to file:', error);
    } finally {
      // 使用 setImmediate 避免阻塞
      setImmediate(() => this.processQueue());
    }
  }
}

interface LoggerOptions {
  scope?: string;
  levelRef?: { level: LogLevel };
}

export class Logger {
  private readonly scope?: string;
  private readonly levelRef: { level: LogLevel };
  private readonly fileManager = FileLogManager.getInstance();

  constructor(options: LoggerOptions = {}) {
    this.scope = options.scope;
    this.levelRef = options.levelRef ?? logConfigState;
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

  private formatMessage(level: LogLevel, message: string, details: unknown[]): { console: string; file: string } {
    const timestamp = new Date().toISOString();
    const scopePrefix = this.scope ? `[${this.scope}]` : '';

    if (logConfigState.config.enableStructuredLogging) {
      // 结构化日志格式 (JSON)
      const logEntry = {
        timestamp,
        level,
        scope: this.scope,
        message,
        details: details.length > 0 ? details : undefined,
      };

      return {
        console: `[${timestamp}] [${level.toUpperCase()}] ${scopePrefix} ${message}`,
        file: JSON.stringify(logEntry),
      };
    } else {
      // 传统格式
      const prefix = `[${timestamp}] [${level.toUpperCase()}] ${scopePrefix}`;
      const detailsStr = details.length > 0 ? ` ${details.map(d => this.stringifyDetail(d)).join(' ')}` : '';

      return {
        console: `${prefix} ${message}${detailsStr}`,
        file: `${prefix} ${message}${detailsStr}`,
      };
    }
  }

  private stringifyDetail(detail: unknown): string {
    try {
      if (typeof detail === 'string') return detail;
      if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }

  private async log(level: LogLevel, message: string, ...details: unknown[]): Promise<void> {
    const activeLevel = this.levelRef.level;
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[activeLevel]) {
      return;
    }

    const { console: consoleMsg, file: fileMsg } = this.formatMessage(level, message, details);
    const method = LEVEL_METHOD[level];

    // 控制台输出
    if (details.length > 0) {
      console[method](consoleMsg, ...details);
    } else {
      console[method](consoleMsg);
    }

    // 文件输出 (异步，不阻塞)
    this.fileManager.writeLog(fileMsg).catch(err => {
      console.error('[Logger] Failed to write to file:', err);
    });
  }
}

export const logger = new Logger({ scope: 'main' });

export function getLogger(scope: string): Logger {
  return logger.child(scope);
}

// 初始化文件日志管理器
FileLogManager.getInstance().initialize().catch(err => {
  console.error('[Logger] Failed to initialize file logging:', err);
});