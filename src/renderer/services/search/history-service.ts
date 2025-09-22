/**
 * 搜索历史存储服务
 * 管理用户的搜索历史记录并提供建议功能
 */

import { defaultStorage } from '@/services/storage/browser';
import type {
  SearchHistoryItem,
  SearchSuggestion,
  SearchAnalyticsStats,
} from '@/services/search/types';

const SEARCH_HISTORY_KEY = 'search_history';
const SEARCH_STATS_KEY = 'search_stats';
const MAX_HISTORY_ITEMS = 100;
const SUGGESTION_LIMIT = 10;

export class SearchHistoryService {
  private static instance: SearchHistoryService;

  private constructor() {}

  static getInstance(): SearchHistoryService {
    if (!SearchHistoryService.instance) {
      SearchHistoryService.instance = new SearchHistoryService();
    }
    return SearchHistoryService.instance;
  }

  /**
   * 添加搜索记录到历史
   */
  async addToHistory(
    item: Omit<SearchHistoryItem, 'id' | 'timestamp'>,
  ): Promise<void> {
    try {
      const history = await this.getHistory();
      const newItem: SearchHistoryItem = {
        ...item,
        id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      // 添加到历史记录开头
      history.unshift(newItem);

      // 限制历史记录数量
      const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);

      await defaultStorage.set(SEARCH_HISTORY_KEY, limitedHistory);

      // 更新搜索统计
      await this.updateSearchStats(item.query);
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }

  /**
   * 获取搜索历史记录
   */
  async getHistory(): Promise<SearchHistoryItem[]> {
    try {
      const history = await defaultStorage.get<SearchHistoryItem[]>(
        SEARCH_HISTORY_KEY,
      );
      if (!history) return [];

      // Ensure timestamps are Date objects
      return history.map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  /**
   * 清除搜索历史
   */
  async clearHistory(): Promise<void> {
    try {
      await defaultStorage.remove(SEARCH_HISTORY_KEY);
      await defaultStorage.remove(SEARCH_STATS_KEY);
    } catch (error) {
      console.error('清除搜索历史失败:', error);
    }
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(input: string): Promise<SearchSuggestion[]> {
    if (!input || input.length < 2) {
      return [];
    }

    const history = await this.getHistory();
    const stats = await this.getSearchStats();

    const suggestions: SearchSuggestion[] = [];

    // 1. 历史搜索建议
    const historySuggestions = this.getHistorySuggestions(input, history);
    suggestions.push(...historySuggestions);

    // 2. 热门搜索建议
    const popularSuggestions = this.getPopularSuggestions(input, stats);
    suggestions.push(...popularSuggestions);

    // 去重和排序
    return this.deduplicateAndSortSuggestions(suggestions, input);
  }

  /**
   * 基于历史记录的搜索建议
   */
  private getHistorySuggestions(
    input: string,
    history: SearchHistoryItem[],
  ): SearchSuggestion[] {
    const inputLower = input.toLowerCase();

    return history
      .filter(
        (item) =>
          item.query.toLowerCase().includes(inputLower) &&
          item.query.toLowerCase() !== inputLower,
      )
      .slice(0, 5)
      .map((item) => ({
        text: item.query,
        type: 'history' as const,
        frequency: this.calculateFrequency(item.timestamp),
        lastUsed: item.timestamp,
        score: this.calculateHistoryScore(item, input),
      }));
  }

  /**
   * 基于热门搜索的建议
   */
  private getPopularSuggestions(
    input: string,
    stats: SearchAnalyticsStats,
  ): SearchSuggestion[] {
    const inputLower = input.toLowerCase();

    return Object.entries(stats.popularTerms)
      .filter(([term]) => term.toLowerCase().includes(inputLower))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([term, frequency]) => ({
        text: term,
        type: 'popular' as const,
        frequency,
        lastUsed: new Date(),
        score: frequency * this.calculateRelevanceScore(term, input),
      }));
  }

  /**
   * 去重和排序建议
   */
  private deduplicateAndSortSuggestions(
    suggestions: SearchSuggestion[],
    _input: string,
  ): SearchSuggestion[] {
    const seen = new Set<string>();
    const uniqueSuggestions: SearchSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.text)) {
        seen.add(suggestion.text);
        uniqueSuggestions.push(suggestion);
      }
    }

    return uniqueSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, SUGGESTION_LIMIT);
  }

  /**
   * 计算历史记录的频率分数
   */
  private calculateFrequency(timestamp: Date): number {
    const now = Date.now();
    const searchTime = timestamp.getTime();
    const hoursAgo = (now - searchTime) / (1000 * 60 * 60);

    // 最近24小时内的搜索权重更高
    if (hoursAgo < 24) {
      return 5;
    } else if (hoursAgo < 168) {
      // 一周内
      return 3;
    } else {
      return 1;
    }
  }

  /**
   * 计算历史记录的相关性分数
   */
  private calculateHistoryScore(item: SearchHistoryItem, input: string): number {
    const query = item.query.toLowerCase();
    const inputLower = input.toLowerCase();

    let score = 0;

    // 完全匹配前缀得分最高
    if (query.startsWith(inputLower)) {
      score += 10;
    }

    // 包含输入文本
    if (query.includes(inputLower)) {
      score += 5;
    }

    // 根据搜索结果的多少加分
    if (item.resultCount > 0) {
      score += Math.min(item.resultCount / 10, 5);
    }

    // 时间衰减因子
    const hoursAgo = (Date.now() - item.timestamp.getTime()) / (1000 * 60 * 60);
    score *= Math.exp(-hoursAgo / 168); // 一周衰减因子

    return score;
  }

  /**
   * 计算文本相关性分数
   */
  private calculateRelevanceScore(term: string, input: string): number {
    const termLower = term.toLowerCase();
    const inputLower = input.toLowerCase();

    if (termLower === inputLower) {
      return 1.0;
    }

    if (termLower.startsWith(inputLower)) {
      return 0.8;
    }

    if (termLower.includes(inputLower)) {
      return 0.5;
    }

    return 0.2;
  }

  /**
   * 获取搜索统计信息
   */
  async getSearchStats(): Promise<SearchAnalyticsStats> {
    try {
      const stats = await defaultStorage.get<SearchAnalyticsStats>(
        SEARCH_STATS_KEY,
      );
      return stats || { totalSearches: 0, popularTerms: {} };
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { totalSearches: 0, popularTerms: {} };
    }
  }

  /**
   * 更新搜索统计
   */
  private async updateSearchStats(query: string): Promise<void> {
    try {
      const stats = await this.getSearchStats();

      stats.totalSearches++;

      // 更新热门词条统计
      const terms = this.extractSearchTerms(query);
      for (const term of terms) {
        stats.popularTerms[term] = (stats.popularTerms[term] || 0) + 1;
      }

      // 限制热门词条数量
      const sortedTerms = Object.entries(stats.popularTerms)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 100);

      stats.popularTerms = Object.fromEntries(sortedTerms);

      await defaultStorage.set(SEARCH_STATS_KEY, stats);
    } catch (error) {
      console.error('更新搜索统计失败:', error);
    }
  }

  /**
   * 从查询中提取搜索词条
   */
  private extractSearchTerms(query: string): string[] {
    // 简单的分词逻辑，可以后续优化
    return (
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2) // 过滤掉短词
        // 过滤逻辑运算符和字段
        .filter((term) => !['and', 'or', 'not'].includes(term) && !term.includes(':'))
    );
  }

  /**
   * 获取最近搜索
   */
  async getRecentSearches(limit: number = 10): Promise<SearchHistoryItem[]> {
    const history = await this.getHistory();
    return history.slice(0, limit);
  }

  /**
   * 获取热门搜索
   */
  async getPopularSearches(limit: number = 10): Promise<SearchSuggestion[]> {
    const stats = await this.getSearchStats();

    return Object.entries(stats.popularTerms)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([text, frequency]) => ({
        text,
        type: 'popular' as const,
        frequency,
        lastUsed: new Date(),
        score: frequency,
      }));
  }
}

// 导出单例实例
export const searchHistoryService = SearchHistoryService.getInstance();