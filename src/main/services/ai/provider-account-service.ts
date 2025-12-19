/**
 * AI Provider 账户存储服务
 * 安全存储各 Provider 的 API Key 和配置
 */

import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { safeStorage } from "electron";
import { getLogger } from "../../utils/logger";
import type { AIProviderId, ProviderAccountConfig } from "@shared/types/ai-provider";

const STORAGE_DIR = path.join(os.homedir(), ".starepo", "ai-accounts");
const ACCOUNTS_FILE = path.join(STORAGE_DIR, "accounts.json");

export interface ProviderAccountMetadata {
  providerId: AIProviderId;
  name?: string;
  baseUrl?: string;
  hasApiKey: boolean;
  lastUsed?: number;
  createdAt: number;
  updatedAt: number;
}

interface StoredAccountData {
  metadata: ProviderAccountMetadata;
  encryptedApiKey?: string;
}

interface AccountsStorage {
  version: string;
  accounts: Record<string, StoredAccountData>;
}

const STORAGE_VERSION = "1.0.0";

export class ProviderAccountService {
  private static instance: ProviderAccountService;
  private isInitialized = false;
  private readonly log = getLogger("ai:provider-account-service");

  private constructor() {}

  static getInstance(): ProviderAccountService {
    if (!ProviderAccountService.instance) {
      ProviderAccountService.instance = new ProviderAccountService();
    }
    return ProviderAccountService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      await this.ensureAccountsFile();
      this.isInitialized = true;
      this.log.debug("ProviderAccountService initialized");
    } catch (error) {
      this.log.error("Failed to initialize ProviderAccountService", error);
      throw error;
    }
  }

  private async ensureAccountsFile(): Promise<void> {
    try {
      await fs.access(ACCOUNTS_FILE);
    } catch {
      const initialStorage: AccountsStorage = {
        version: STORAGE_VERSION,
        accounts: {},
      };
      await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(initialStorage, null, 2), "utf8");
    }
  }

  private async readAccounts(): Promise<AccountsStorage> {
    try {
      const content = await fs.readFile(ACCOUNTS_FILE, "utf8");
      const data = JSON.parse(content) as AccountsStorage;
      return data;
    } catch (error) {
      this.log.error("Failed to read accounts file", error);
      return { version: STORAGE_VERSION, accounts: {} };
    }
  }

  private async writeAccounts(data: AccountsStorage): Promise<void> {
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  private getAccountKey(providerId: AIProviderId): string {
    return `ai_provider_${providerId}`;
  }

  async saveAccount(config: ProviderAccountConfig): Promise<void> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      const key = this.getAccountKey(config.providerId);

      const metadata: ProviderAccountMetadata = {
        providerId: config.providerId,
        name: config.name,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKey,
        createdAt: accounts.accounts[key]?.metadata.createdAt || Date.now(),
        updatedAt: Date.now(),
        lastUsed: Date.now(),
      };

      const accountData: StoredAccountData = {
        metadata,
      };

      if (config.apiKey) {
        const encryptedKey = safeStorage.encryptString(config.apiKey);
        accountData.encryptedApiKey = encryptedKey.toString("base64");
      }

      accounts.accounts[key] = accountData;
      await this.writeAccounts(accounts);

      this.log.debug("Provider account saved", { providerId: config.providerId });
    } catch (error) {
      this.log.error("Failed to save provider account", error);
      throw new Error(`保存 Provider 账户失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async getAccount(providerId: AIProviderId): Promise<ProviderAccountConfig | null> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      const key = this.getAccountKey(providerId);
      const accountData = accounts.accounts[key];

      if (!accountData) {
        return null;
      }

      const config: ProviderAccountConfig = {
        providerId,
        name: accountData.metadata.name,
        baseUrl: accountData.metadata.baseUrl,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      if (accountData.encryptedApiKey) {
        try {
          const encryptedBuffer = Buffer.from(accountData.encryptedApiKey, "base64");
          config.apiKey = safeStorage.decryptString(encryptedBuffer);
        } catch {
          this.log.warn("Failed to decrypt API key", { providerId });
        }
      }

      return config;
    } catch (error) {
      this.log.error("Failed to get provider account", error);
      return null;
    }
  }

  async deleteAccount(providerId: AIProviderId): Promise<void> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      const key = this.getAccountKey(providerId);

      if (accounts.accounts[key]) {
        delete accounts.accounts[key];
        await this.writeAccounts(accounts);
        this.log.debug("Provider account deleted", { providerId });
      }
    } catch (error) {
      this.log.error("Failed to delete provider account", error);
      throw new Error(`删除 Provider 账户失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async listAccounts(): Promise<ProviderAccountMetadata[]> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      return Object.values(accounts.accounts)
        .map((data) => data.metadata)
        .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    } catch (error) {
      this.log.error("Failed to list provider accounts", error);
      return [];
    }
  }

  async hasAccount(providerId: AIProviderId): Promise<boolean> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      const key = this.getAccountKey(providerId);
      return key in accounts.accounts;
    } catch {
      return false;
    }
  }

  async updateLastUsed(providerId: AIProviderId): Promise<void> {
    await this.initialize();

    try {
      const accounts = await this.readAccounts();
      const key = this.getAccountKey(providerId);
      const accountData = accounts.accounts[key];

      if (accountData) {
        accountData.metadata.lastUsed = Date.now();
        accountData.metadata.updatedAt = Date.now();
        await this.writeAccounts(accounts);
      }
    } catch (error) {
      this.log.error("Failed to update last used time", error);
    }
  }

  async clearAll(): Promise<void> {
    await this.initialize();

    try {
      const initialStorage: AccountsStorage = {
        version: STORAGE_VERSION,
        accounts: {},
      };
      await this.writeAccounts(initialStorage);
      this.log.debug("All provider accounts cleared");
    } catch (error) {
      this.log.error("Failed to clear provider accounts", error);
      throw new Error(`清除所有 Provider 账户失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
}

export const providerAccountService = ProviderAccountService.getInstance();
