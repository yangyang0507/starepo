/**
 * 会话元数据管理服务
 * 负责会话元数据的 CRUD、缓存和持久化
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { ConversationMeta } from '@shared/types/conversation';
import { logger } from '../../utils/logger';

/**
 * 会话元数据索引结构
 */
interface ConversationIndex {
  conversations: Record<string, ConversationMeta>;
  version: number;
  lastUpdated: number;
}

export class ConversationMetadataService {
  private conversations: Map<string, ConversationMeta> = new Map();
  private isInitialized = false;
  private readonly storageDir: string;
  private readonly indexFilePath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500;

  constructor() {
    // 存储路径：~/.starepo/conversations/
    this.storageDir = path.join(app.getPath('home'), '.starepo', 'conversations');
    this.indexFilePath = path.join(this.storageDir, 'index.json');
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 确保存储目录存在
      await fs.mkdir(this.storageDir, { recursive: true });

      // 加载索引文件
      await this.loadIndex();

      this.isInitialized = true;
      logger.info('[ConversationMetadata] Service initialized');
    } catch (error) {
      logger.error('[ConversationMetadata] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * 加载索引文件
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexFilePath, 'utf-8');
      const index: ConversationIndex = JSON.parse(data);

      // 加载到内存
      this.conversations.clear();
      Object.entries(index.conversations).forEach(([id, meta]) => {
        this.conversations.set(id, meta);
      });

      logger.info(`[ConversationMetadata] Loaded ${this.conversations.size} conversations`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // 文件不存在，初始化为空
        logger.info('[ConversationMetadata] No existing index, starting fresh');
      } else {
        logger.error('[ConversationMetadata] Failed to load index:', error);
        throw error;
      }
    }
  }

  /**
   * 保存索引文件（带防抖）
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveIndex().catch(error => {
        logger.error('[ConversationMetadata] Failed to save index:', error);
      });
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * 立即保存索引文件
   */
  private async saveIndex(): Promise<void> {
    try {
      const index: ConversationIndex = {
        conversations: Object.fromEntries(this.conversations),
        version: 1,
        lastUpdated: Date.now(),
      };

      await fs.writeFile(
        this.indexFilePath,
        JSON.stringify(index, null, 2),
        'utf-8'
      );

      logger.debug('[ConversationMetadata] Index saved successfully');
    } catch (error) {
      logger.error('[ConversationMetadata] Failed to save index:', error);
      throw error;
    }
  }

  /**
   * 创建或获取会话元数据
   */
  async createOrGet(conversationId: string, tempTitle: string): Promise<ConversationMeta> {
    let meta = this.conversations.get(conversationId);

    if (!meta) {
      // 创建新的元数据
      meta = {
        id: conversationId,
        title: tempTitle,
        tempTitle,
        isTitleGenerated: false,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.conversations.set(conversationId, meta);
      this.scheduleSave();

      logger.info(`[ConversationMetadata] Created new conversation: ${conversationId}`);
    }

    return meta;
  }

  /**
   * 更新会话标题
   */
  async updateTitle(
    conversationId: string,
    title: string,
    status: 'ready' | 'failed',
    error?: string
  ): Promise<ConversationMeta> {
    const meta = this.conversations.get(conversationId);

    if (!meta) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // 更新元数据
    meta.title = title;
    meta.status = status;
    meta.isTitleGenerated = status === 'ready';
    meta.updatedAt = Date.now();

    if (error) {
      meta.error = error;
    }

    this.conversations.set(conversationId, meta);
    this.scheduleSave();

    logger.info(`[ConversationMetadata] Updated title for ${conversationId}: ${title}`);

    return meta;
  }

  /**
   * 获取所有会话列表
   */
  async list(): Promise<ConversationMeta[]> {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 根据 ID 获取会话
   */
  async getById(conversationId: string): Promise<ConversationMeta | undefined> {
    return this.conversations.get(conversationId);
  }

  /**
   * 删除会话
   */
  async delete(conversationId: string): Promise<void> {
    const deleted = this.conversations.delete(conversationId);

    if (deleted) {
      this.scheduleSave();
      logger.info(`[ConversationMetadata] Deleted conversation: ${conversationId}`);
    }
  }

  /**
   * 更新会话的最后活动时间
   */
  async touch(conversationId: string): Promise<void> {
    const meta = this.conversations.get(conversationId);

    if (meta) {
      meta.updatedAt = Date.now();
      this.conversations.set(conversationId, meta);
      this.scheduleSave();
    }
  }

  /**
   * 清理服务（应用退出时调用）
   */
  async cleanup(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    // 立即保存
    await this.saveIndex();
    logger.info('[ConversationMetadata] Service cleaned up');
  }
}

// 导出单例
export const conversationMetadataService = new ConversationMetadataService();
