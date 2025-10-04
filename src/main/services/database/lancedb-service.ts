import * as lancedb from '@lancedb/lancedb';
// import * as arrow from 'apache-arrow'; // 暂时不需要直接使用 arrow
import type { GitHubRepository, GitHubUser } from '../../../shared/types/index.js';
import type { SearchResult, DatabaseStats } from './types.js';
import * as path from 'path';
import * as os from 'os';

/**
 * LanceDB 数据库服务类
 * 提供向量化存储和检索功能，用于 GitHub 仓库数据的持久化
 */
export class LanceDBService {
  private db: any = null; // 使用 any 类型避免类型问题
  private repositoriesTable: any = null;
  private usersTable: any = null;
  private initialized = false;
  private dbPath: string;

  constructor() {
    // 设置数据库路径到用户目录
    this.dbPath = path.join(os.homedir(), '.starepo', 'lancedb');
  }

  /**
   * 初始化 LanceDB 服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 连接到 LanceDB
      this.db = await lancedb.connect(this.dbPath);
      console.log('LanceDB 连接成功，路径:', this.dbPath);

      // 初始化表（如果不存在则创建）
      await this.initializeTables();

      this.initialized = true;
      console.log('LanceDB 服务初始化成功');
    } catch (error) {
      console.error('LanceDB 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化数据表
   */
  private async initializeTables(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      // 尝试打开现有的仓库表
      this.repositoriesTable = await this.db.openTable('github_repositories');
      console.log('打开现有仓库表成功');
    } catch {
      // 如果表不存在，创建新表
      console.log('仓库表不存在，创建新表...');
      await this.createRepositoriesTable();
    }

    try {
      // 尝试打开现有的用户表
      this.usersTable = await this.db.openTable('github_users');
      console.log('打开现有用户表成功');
    } catch {
      // 如果表不存在，创建新表
      console.log('用户表不存在，创建新表...');
      await this.createUsersTable();
    }
  }

  /**
   * 创建仓库表
   */
  private async createRepositoriesTable(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    // 创建包含初始数据的表
    const initialData = [{
      id: 0,
      name: 'placeholder',
      full_name: 'placeholder/placeholder',
      description: 'placeholder',
      html_url: 'https://github.com/placeholder/placeholder',
      language: 'placeholder',
      stargazers_count: 0,
      forks_count: 0,
      topics: '',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      owner_login: 'placeholder',
      document: 'placeholder',
      vector: new Array(1536).fill(0.0),
    }];

    this.repositoriesTable = await this.db.createTable('github_repositories', initialData);

    // 删除占位符数据
    await this.repositoriesTable.delete('id = 0');

    console.log('仓库表创建成功');
  }

  /**
   * 创建用户表
   */
  private async createUsersTable(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    // 创建包含初始数据的用户表
    const initialData = [{
      id: 0,
      login: 'placeholder',
      name: 'placeholder',
      avatar_url: 'https://avatars.githubusercontent.com/u/0',
      html_url: 'https://github.com/placeholder',
      bio: 'placeholder',
      public_repos: 0,
      followers: 0,
      following: 0,
      created_at: '2023-01-01T00:00:00Z',
      document: 'placeholder',
      vector: new Array(1536).fill(0.0),
    }];

    this.usersTable = await this.db.createTable('github_users', initialData);

    // 删除占位符数据
    await this.usersTable.delete('id = 0');

    console.log('用户表创建成功');
  }

  /**
   * 确保服务已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db || !this.repositoriesTable || !this.usersTable) {
      throw new Error('LanceDB 服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 添加或更新 GitHub 仓库
   */
  async upsertRepositories(repositories: GitHubRepository[]): Promise<void> {
    this.ensureInitialized();

    if (!repositories.length) {
      return;
    }

    // 先去重，避免重复写入
    const uniqueRepositories = this.deduplicateRepositories(repositories);

    // 删除已存在的记录，模拟 upsert 行为
    const ids = uniqueRepositories.map(repo => repo.id);
    await this.deleteRepositoriesByIds(ids);

    // 准备数据
    const data = uniqueRepositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      html_url: repo.html_url,
      language: repo.language || '',
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      topics: repo.topics?.join(',') || '',
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      owner_login: repo.owner.login,
      document: this.createRepositoryDocument(repo),
      // 暂时设置空向量，后续可以集成嵌入函数
      vector: new Array(1536).fill(0.0),
    }));

    // 直接插入数据数组
    await this.repositoriesTable!.add(data);
    console.log(`已存储 ${uniqueRepositories.length} 个仓库到 LanceDB`);
  }

  /**
   * 根据 ID 获取仓库
   */
  async getRepositoryById(id: number): Promise<GitHubRepository | null> {
    this.ensureInitialized();

    const result = await this.repositoriesTable!
      .search([0])  // 使用空向量搜索
      .where(`id = ${id}`)
      .limit(1)
      .toArray();

    if (result.length === 0) {
      return null;
    }

    return this.parseRepositoryFromRecord(result[0]);
  }

  /**
   * 获取所有仓库
   */
  async getAllRepositories(limit?: number, _offset?: number): Promise<GitHubRepository[]> {
    this.ensureInitialized();

    let query = this.repositoriesTable!.search(new Array(1536).fill(0.0));

    if (limit) {
      query = query.limit(limit);
    }

    const result = await query.toArray();
    return this.parseRepositoryRecords(result);
  }

  /**
   * 语义搜索仓库
   */
  async searchRepositories(
    query: string,
    limit: number = 10,
    where?: string
  ): Promise<SearchResult<GitHubRepository>> {
    this.ensureInitialized();

    // 使用向量搜索
    let searchQuery = this.repositoriesTable!
      .search(new Array(1536).fill(0.0))
      .limit(limit);

    // 简单的文本搜索过滤
    let whereClause = '';
    if (query) {
      whereClause = `document LIKE '%${query}%'`;
    }

    if (where) {
      whereClause = whereClause ? `${whereClause} AND ${where}` : where;
    }

    if (whereClause) {
      searchQuery = searchQuery.where(whereClause);
    }

    const result = await searchQuery.toArray();
    const repositories = this.parseRepositoryRecords(result);

    return {
      items: repositories,
      scores: new Array(repositories.length).fill(1.0),
      totalCount: repositories.length
    };
  }

  /**
   * 根据编程语言过滤仓库
   */
  async getRepositoriesByLanguage(language: string, limit?: number): Promise<GitHubRepository[]> {
    this.ensureInitialized();

    let query = this.repositoriesTable!
      .search(new Array(1536).fill(0.0))
      .where(`language = '${language}'`);

    if (limit) {
      query = query.limit(limit);
    }

    const result = await query.toArray();
    return this.parseRepositoryRecords(result);
  }

  /**
   * 根据 star 数量范围获取仓库
   */
  async getRepositoriesByStarRange(
    minStars: number,
    maxStars: number,
    limit?: number
  ): Promise<GitHubRepository[]> {
    this.ensureInitialized();

    let query = this.repositoriesTable!
      .search(new Array(1536).fill(0.0))
      .where(`stargazers_count >= ${minStars} AND stargazers_count <= ${maxStars}`);

    if (limit) {
      query = query.limit(limit);
    }

    const result = await query.toArray();
    return this.parseRepositoryRecords(result);
  }

  /**
   * 删除仓库
   */
  async deleteRepositories(ids: number[]): Promise<void> {
    this.ensureInitialized();

    const whereClause = `id IN (${ids.join(',')})`;
    await this.repositoriesTable!.delete(whereClause);

    console.log(`已从 LanceDB 删除 ${ids.length} 个仓库`);
  }

  /**
   * 添加或更新用户
   */
  async upsertUser(user: GitHubUser): Promise<void> {
    this.ensureInitialized();

    const data = [{
      id: user.id,
      login: user.login,
      name: user.name || '',
      avatar_url: user.avatar_url,
      bio: user.bio || '',
      public_repos: user.public_repos,
      followers: user.followers,
      following: user.following,
      created_at: user.created_at,
      document: this.createUserDocument(user),
      vector: new Array(1536).fill(0.0),
    }];

    await this.usersTable!.add(data);
    console.log(`已存储用户 ${user.login} 到 LanceDB`);
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(id: number): Promise<GitHubUser | null> {
    this.ensureInitialized();

    const result = await this.usersTable!
      .search(new Array(1536).fill(0.0))
      .where(`id = ${id}`)
      .limit(1)
      .toArray();

    if (result.length === 0) {
      return null;
    }

    return this.parseUserFromRecord(result[0]);
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<DatabaseStats> {
    this.ensureInitialized();

    const [repositoriesCount, usersCount] = await Promise.all([
      this.repositoriesTable!.countRows(),
      this.usersTable!.countRows()
    ]);

    const tableNames = await this.db!.tableNames();

    return {
      repositoriesCount,
      usersCount,
      tablesCount: tableNames.length
    };
  }

  /**
   * 清除所有数据
   */
  async reset(): Promise<void> {
    this.ensureInitialized();

    try {
      // 删除现有表
      await this.db!.dropTable('github_repositories');
      await this.db!.dropTable('github_users');

      // 重新初始化表
      await this.initializeTables();

      console.log('LanceDB 数据已重置');
    } catch (error) {
      console.error('重置 LanceDB 失败:', error);
      throw error;
    }
  }

  /**
   * 创建仓库文档（用于搜索）
   */
  private createRepositoryDocument(repo: GitHubRepository): string {
    const parts = [
      repo.name,
      repo.full_name,
      repo.description || '',
      repo.language || '',
      ...(repo.topics || [])
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * 创建用户文档（用于搜索）
   */
  private createUserDocument(user: GitHubUser): string {
    const parts = [
      user.login,
      user.name || '',
      user.bio || '',
      user.company || '',
      user.location || '',
      user.blog || ''
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * 从记录解析仓库对象
   */
  private parseRepositoryFromRecord(record: any): GitHubRepository {
    return {
      id: record.id,
      name: record.name,
      full_name: record.full_name,
      description: record.description || null,
      html_url: record.html_url,
      clone_url: record.html_url.replace('github.com', 'github.com') + '.git',
      ssh_url: `git@github.com:${record.full_name}.git`,
      language: record.language || null,
      stargazers_count: record.stargazers_count,
      watchers_count: record.stargazers_count, // 假设相等
      forks_count: record.forks_count,
      open_issues_count: 0, // 默认值
      created_at: record.created_at,
      updated_at: record.updated_at,
      pushed_at: record.updated_at, // 假设相等
      size: 0, // 默认值
      default_branch: 'main', // 默认值
      topics: record.topics ? record.topics.split(',').filter(Boolean) : [],
      archived: false, // 默认值
      disabled: false, // 默认值
      private: false, // 默认值
      fork: false, // 默认值
      owner: {
        id: 0, // 需要从其他地方获取
        login: record.owner_login,
        avatar_url: '', // 需要从其他地方获取
      },
      license: undefined, // 暂不支持
    };
  }

  /**
   * 从记录解析用户对象
   */
  private parseUserFromRecord(record: any): GitHubUser {
    return {
      id: record.id,
      login: record.login,
      name: record.name || null,
      email: null, // 暂不支持
      avatar_url: record.avatar_url,
      bio: record.bio || null,
      blog: null, // 暂不支持
      company: null, // 暂不支持
      location: null, // 暂不支持
      public_repos: record.public_repos,
      public_gists: 0, // 默认值
      followers: record.followers,
      following: record.following,
      created_at: record.created_at,
      updated_at: record.created_at, // 假设相等
    };
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      // LanceDB 不需要显式关闭连接
      this.db = null;
      this.repositoriesTable = null;
      this.usersTable = null;
      this.initialized = false;
      console.log('LanceDB 连接已关闭');
    }
  }

  /**
   * 批量删除指定 ID 的仓库
   */
  private async deleteRepositoriesByIds(ids: number[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const whereClause = `id IN (${chunk.join(',')})`;
      await this.repositoriesTable!.delete(whereClause);
    }
  }

  /**
   * 去重仓库列表
   */
  private deduplicateRepositories(repositories: GitHubRepository[]): GitHubRepository[] {
    const map = new Map<number, GitHubRepository>();

    repositories.forEach(repo => {
      if (!map.has(repo.id)) {
        map.set(repo.id, repo);
      }
    });

    return Array.from(map.values());
  }

  /**
   * 解析数据库记录并按 ID 去重
   */
  private parseRepositoryRecords(records: any[]): GitHubRepository[] {
    const map = new Map<number, GitHubRepository>();

    records.forEach(record => {
      if (record && typeof record.id === 'number' && !map.has(record.id)) {
        map.set(record.id, this.parseRepositoryFromRecord(record));
      }
    });

    return Array.from(map.values());
  }
}

// 导出单例实例
export const lancedbService = new LanceDBService();
