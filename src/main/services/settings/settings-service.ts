import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ThemeMode, Language } from '../../../shared/types/index.js';
import { getLogger } from '../../utils/logger';

interface AppSettings {
  theme: ThemeMode;
  language: Language;
  updatedAt: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  updatedAt: new Date(0).toISOString()
};

export class SettingsService {
  private settingsPath: string;
  private settingsCache: AppSettings | null = null;
  private isLoaded = false;
  private readonly log = getLogger('settings');

  constructor() {
    this.settingsPath = path.join(os.homedir(), '.starepo', 'settings.json');
  }

  async getSettings(): Promise<AppSettings> {
    if (this.isLoaded && this.settingsCache) {
      return this.settingsCache;
    }

    try {
      await this.ensureDirectory();
      const raw = await fs.readFile(this.settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      this.settingsCache = this.normalizeSettings(parsed);
    } catch (error) {
      this.log.warn('读取设置文件失败，使用默认设置', error);
      this.settingsCache = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
      await this.persistSettings(this.settingsCache);
    }

    this.isLoaded = true;
    return this.settingsCache!;
  }

  async getTheme(): Promise<ThemeMode> {
    const settings = await this.getSettings();
    return settings.theme;
  }

  async setTheme(theme: ThemeMode): Promise<ThemeMode> {
    const normalizedTheme: ThemeMode = theme ?? DEFAULT_SETTINGS.theme;
    await this.updateSettings({ theme: normalizedTheme });
    this.log.info('主题模式已更新', { theme: normalizedTheme });
    return normalizedTheme;
  }

  async getLanguage(): Promise<Language> {
    const settings = await this.getSettings();
    return settings.language;
  }

  async setLanguage(language: Language): Promise<Language> {
    const normalizedLanguage: Language = language ?? DEFAULT_SETTINGS.language;
    await this.updateSettings({ language: normalizedLanguage });
    this.log.info('语言设置已更新', { language: normalizedLanguage });
    return normalizedLanguage;
  }

  async reset(): Promise<void> {
    this.settingsCache = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
    this.isLoaded = true;
    await this.persistSettings(this.settingsCache);
    this.log.warn('设置已重置为默认值');
  }

  private async updateSettings(update: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...update,
      updatedAt: new Date().toISOString()
    };

    this.settingsCache = merged;
    await this.persistSettings(merged);
    return merged;
  }

  private async persistSettings(settings: AppSettings): Promise<void> {
    await this.ensureDirectory();
    const payload = JSON.stringify(settings, null, 2);
    await fs.writeFile(this.settingsPath, payload, 'utf8');
    this.log.debug('设置已写入磁盘', { path: this.settingsPath });
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
  }

  private normalizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
    if (!settings) {
      return { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
    }

    const theme = this.isValidTheme(settings.theme) ? settings.theme! : DEFAULT_SETTINGS.theme;
    const language = this.isValidLanguage(settings.language) ? settings.language! : DEFAULT_SETTINGS.language;

    return {
      theme,
      language,
      updatedAt: settings.updatedAt ?? new Date().toISOString()
    };
  }

  private isValidTheme(theme?: string): theme is ThemeMode {
    return theme === 'light' || theme === 'dark' || theme === 'system';
  }

  private isValidLanguage(language?: string): language is Language {
    return typeof language === 'string' && language.length > 0;
  }
}

export const settingsService = new SettingsService();
