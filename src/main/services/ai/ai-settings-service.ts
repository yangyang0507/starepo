/**
 * AI Settings 持久化服务
 * 负责 AI 配置的存储和读取
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { AISettings } from '@shared/types';
import { getLogger } from '../../utils/logger';

const AI_SETTINGS_DIR = path.join(os.homedir(), '.starepo');
const AI_SETTINGS_FILE = path.join(AI_SETTINGS_DIR, 'ai-settings.json');

const logger = getLogger('ai:settings');

export class AISettingsService {
  private static instance: AISettingsService;
  private settings: AISettings | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AISettingsService {
    if (!AISettingsService.instance) {
      AISettingsService.instance = new AISettingsService();
    }
    return AISettingsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await fs.mkdir(AI_SETTINGS_DIR, { recursive: true });
      await this.loadSettings();
      this.isInitialized = true;
      logger.debug('AI settings service initialized');
    } catch (error) {
      logger.error('Failed to initialize AI settings service', error);
      throw error;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const content = await fs.readFile(AI_SETTINGS_FILE, 'utf8');
      this.settings = JSON.parse(content) as AISettings;
      logger.debug('AI settings loaded from disk');
    } catch (error) {
      // 文件不存在或解析失败，使用默认设置
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('AI settings file not found, will be created on first save');
        this.settings = null;
      } else {
        logger.warn('Failed to load AI settings file', error);
        this.settings = null;
      }
    }
  }

  async getSettings(): Promise<AISettings | null> {
    await this.initialize();
    return this.settings;
  }

  async updateSettings(settings: Partial<AISettings>): Promise<void> {
    await this.initialize();

    // 合并设置
    this.settings = this.settings
      ? { ...this.settings, ...settings }
      : (settings as AISettings);

    // 持久化到磁盘
    try {
      const content = JSON.stringify(this.settings, null, 2);
      await fs.writeFile(AI_SETTINGS_FILE, content, 'utf8');
      logger.debug('AI settings saved to disk');
    } catch (error) {
      logger.error('Failed to save AI settings', error);
      throw new Error(`保存 AI 设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async clearSettings(): Promise<void> {
    await this.initialize();

    this.settings = null;
    try {
      await fs.unlink(AI_SETTINGS_FILE);
      logger.debug('AI settings file deleted');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to delete AI settings file', error);
      }
    }
  }
}

export const aiSettingsService = AISettingsService.getInstance();
