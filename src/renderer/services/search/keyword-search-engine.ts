/**
 * 关键词搜索引擎 - 基础文本搜索实现
 */

import type { GitHubRepository } from '@/services/github/types';
import type {
  SearchQuery,
  SearchResult,
  SearchOptions,
  SearchMatch,
  TextHighlight,
  SearchResultMetadata,
  RelevanceFactor,
  SearchStats,
  SearchSuggestion,
  SearchExplanation,
  ISearchEngine,
  ParsedQuery,
  QueryClause,
  ExplanationStep
} from './types';
import { SearchError, SearchErrorCode } from './types';
import { TextAnalyzer } from './text-analyzer';
import { SearchIndexManager } from './search-index';

export class KeywordSearchEngine implements ISearchEngine {
  private indexManager: SearchIndexManager;
  private textAnalyzer: TextAnalyzer;
  private isIndexReady: boolean = false;

  constructor() {
    this.textAnalyzer = new TextAnalyzer();
    this.indexManager = new SearchIndexManager();
  }

  /**
   * 构建搜索索引
   */
  async buildIndex(repositories: GitHubRepository[]): Promise<void> {
    try {
      await this.indexManager.buildIndex(repositories);
      this.isIndexReady = true;
    } catch (error) {
      this.isIndexReady = false;
      throw new SearchError(
        '索引构建失败',
        SearchErrorCode.INTERNAL_ERROR,
        { originalError: error }
      );
    }
  }

  /**
   * 更新索引中的文档
   */
  async updateIndex(repository: GitHubRepository): Promise<void> {
    try {
      await this.indexManager.updateDocument(repository);
    } catch (error) {
      throw new SearchError(
        '索引更新失败',
        SearchErrorCode.INTERNAL_ERROR,
        { repositoryId: repository.id, originalError: error }
      );
    }
  }

  /**
   * 从索引中删除文档
   */
  async removeFromIndex(repositoryId: string): Promise<void> {
    try {
      await this.indexManager.removeDocument(repositoryId);
    } catch (error) {
      throw new SearchError(
        '索引删除失败',
        SearchErrorCode.INTERNAL_ERROR,
        { repositoryId, originalError: error }
      );
    }
  }

  /**
   * 执行搜索
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isIndexReady) {
      throw new SearchError(
        '搜索索引未就绪',
        SearchErrorCode.INDEX_NOT_READY
      );
    }

    const startTime = Date.now();

    try {
      // 解析查询
      const parsedQuery = this.parseQuery(query.text, query.options);
      
      // 执行搜索
      const results = await this.executeSearch(parsedQuery, query.options);
      
      // 计算搜索时间
      const searchTime = Date.now() - startTime;
      
      // 添加元数据
      return results.map(result => ({
        ...result,
        metadata: {
          ...result.metadata,
          searchTime
        }
      }));

    } catch (error) {
      if (error instanceof SearchError) {
        throw error;
      }
      throw new SearchError(
        '搜索执行失败',
        SearchErrorCode.INTERNAL_ERROR,
        { query: query.text, originalError: error }
      );
    }
  }

  /**
   * 生成搜索建议
   */
  async suggest(input: string, limit: number = 5): Promise<SearchSuggestion[]> {
    if (!input || input.length < 2) {
      return [];
    }

    const vocabulary = this.indexManager.getAllTerms();
    const suggestions = this.textAnalyzer.generateSuggestions(input, vocabulary, limit);

    return suggestions.map(suggestion => ({
      text: suggestion,
      type: 'completion' as const,
      score: this.calculateSuggestionScore(suggestion, input)
    }));
  }

  /**
   * 获取搜索统计信息
   */
  async getStats(): Promise<SearchStats> {
    const indexStats = this.indexManager.getIndexStats();
    
    return {
      totalResults: indexStats.totalDocuments,
      searchTime: 0, // 需要在实际搜索中计算
      indexSize: indexStats.totalTerms,
      cacheHitRate: 0 // 未来实现缓存时添加
    };
  }

  /**
   * 解释搜索过程
   */
  async explain(query: SearchQuery): Promise<SearchExplanation> {
    const startTime = Date.now();
    const steps: ExplanationStep[] = [];

    // 步骤1: 查询解析
    const parseStart = Date.now();
    const parsedQuery = this.parseQuery(query.text, query.options);
    const parseTime = Date.now() - parseStart;
    steps.push({
      step: 'query_parsing',
      description: '解析搜索查询',
      time: Math.max(parseTime, 1), // 确保至少1ms
      details: { parsedQuery }
    });

    // 步骤2: 词项查找
    const lookupStart = Date.now();
    const termResults = new Map<string, number>();
    for (const clause of parsedQuery.clauses) {
      if (clause.type === 'term') {
        const postingList = this.indexManager.getPostingList(clause.value);
        termResults.set(clause.value, postingList?.documentFrequency || 0);
      }
    }
    const lookupTime = Date.now() - lookupStart;
    steps.push({
      step: 'term_lookup',
      description: '查找词项在索引中的出现频率',
      time: Math.max(lookupTime, 1), // 确保至少1ms
      results: termResults.size,
      details: { termResults: Object.fromEntries(termResults) }
    });

    const totalTime = Date.now() - startTime;
    return {
      query: parsedQuery,
      strategy: 'keyword_search',
      steps,
      totalTime: Math.max(totalTime, 1) // 确保总时间至少1ms
    };
  }

  /**
   * 解析搜索查询
   */
  private parseQuery(queryText: string, options?: SearchOptions): ParsedQuery {
    const clauses: QueryClause[] = [];
    const caseSensitive = options?.caseSensitive || false;
    
    // 简单的查询解析（未来可以扩展为更复杂的语法）
    const terms = queryText.trim().split(/\s+/);
    
    for (const term of terms) {
      if (term.includes(':')) {
        // 字段搜索 (field:value)
        const [field, value] = term.split(':', 2);
        clauses.push({
          type: 'field',
          field: field.toLowerCase(),
          value: caseSensitive ? value : value.toLowerCase(),
          operator: 'AND'
        });
      } else if (term.includes('*')) {
        // 通配符搜索
        clauses.push({
          type: 'wildcard',
          value: caseSensitive ? term : term.toLowerCase(),
          operator: 'AND'
        });
      } else if (term.includes('~')) {
        // 模糊搜索
        const [value, distance] = term.split('~');
        clauses.push({
          type: 'fuzzy',
          value: caseSensitive ? value : value.toLowerCase(),
          operator: 'AND',
          fuzzyDistance: parseInt(distance) || 2
        });
      } else {
        // 普通词项
        clauses.push({
          type: 'term',
          value: caseSensitive ? term : term.toLowerCase(),
          operator: 'AND'
        });
      }
    }

    return {
      originalQuery: queryText,
      clauses,
      filters: options?.filters || {},
      options: options || {}
    };
  }

  /**
   * 执行搜索
   */
  private async executeSearch(
    parsedQuery: ParsedQuery, 
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const candidateDocuments = new Map<string, number>();
    const matchInfo = new Map<string, SearchMatch[]>();

    // 处理每个查询子句
    for (const clause of parsedQuery.clauses) {
      const clauseResults = await this.executeClause(clause);
      
      for (const [docId, score] of clauseResults.entries()) {
        const currentScore = candidateDocuments.get(docId) || 0;
        candidateDocuments.set(docId, currentScore + score);
        
        // 收集匹配信息
        if (!matchInfo.has(docId)) {
          matchInfo.set(docId, []);
        }
        
        const matches = this.generateMatches(docId, clause);
        matchInfo.get(docId)!.push(...matches);
      }
    }

    // 转换为搜索结果
    const results: SearchResult[] = [];
    
    for (const [docId, score] of candidateDocuments.entries()) {
      const document = this.indexManager.getDocument(docId);
      if (!document) continue;

      // 应用筛选器
      if (!this.passesFilters(document.metadata.repository, parsedQuery.filters)) {
        continue;
      }

      const matches = matchInfo.get(docId) || [];
      const relevanceFactors = this.calculateRelevanceFactors(document, parsedQuery);

      results.push({
        repository: document.metadata.repository,
        score,
        type: 'keyword',
        matches,
        metadata: {
          matchedFields: [...new Set(matches.map(m => m.field))],
          relevanceFactors,
          searchTime: 0, // 将在上层设置
          confidence: this.calculateConfidence(score, matches)
        }
      });
    }

    // 排序结果
    this.sortResults(results, parsedQuery.options);
    
    // 应用限制
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * 执行单个查询子句
   */
  private async executeClause(clause: QueryClause): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    switch (clause.type) {
      case 'term':
        return this.executeTermClause(clause);
      
      case 'field':
        return this.executeFieldClause(clause);
      
      case 'wildcard':
        return this.executeWildcardClause(clause);
      
      case 'fuzzy':
        return this.executeFuzzyClause(clause);
      
      default:
        return results;
    }
  }

  /**
   * 执行词项查询
   */
  private executeTermClause(clause: QueryClause): Map<string, number> {
    const results = new Map<string, number>();
    const postingList = this.indexManager.getPostingList(clause.value);
    
    if (!postingList) return results;

    for (const posting of postingList.postings) {
      const tfIdfScore = this.indexManager.calculateTfIdf(clause.value, posting.documentId);
      
      // 应用字段权重
      let fieldBoost = 1.0;
      for (const [field, boost] of posting.fieldBoosts.entries()) {
        fieldBoost = Math.max(fieldBoost, boost);
      }
      
      const finalScore = tfIdfScore * fieldBoost * (clause.boost || 1.0);
      results.set(posting.documentId, finalScore);
    }

    return results;
  }

  /**
   * 执行字段查询
   */
  private executeFieldClause(clause: QueryClause): Map<string, number> {
    const results = new Map<string, number>();
    
    if (!clause.field) return results;
    
    const postingList = this.indexManager.getFieldPostingList(clause.field, clause.value);
    if (!postingList) return results;

    for (const posting of postingList.postings) {
      const tfIdfScore = this.indexManager.calculateTfIdf(clause.value, posting.documentId);
      const finalScore = tfIdfScore * 2.0 * (clause.boost || 1.0); // 字段匹配获得额外权重
      results.set(posting.documentId, finalScore);
    }

    return results;
  }

  /**
   * 执行通配符查询
   */
  private executeWildcardClause(clause: QueryClause): Map<string, number> {
    const results = new Map<string, number>();
    const pattern = clause.value.replace(/\*/g, '.*');
    const regex = new RegExp(pattern, 'i');

    const allTerms = this.indexManager.getAllTerms();
    const matchingTerms = allTerms.filter(term => regex.test(term));

    for (const term of matchingTerms) {
      const termResults = this.executeTermClause({ ...clause, value: term, type: 'term' });
      for (const [docId, score] of termResults.entries()) {
        const currentScore = results.get(docId) || 0;
        results.set(docId, currentScore + score * 0.8); // 通配符匹配权重稍低
      }
    }

    return results;
  }

  /**
   * 执行模糊查询
   */
  private executeFuzzyClause(clause: QueryClause): Map<string, number> {
    const results = new Map<string, number>();
    const maxDistance = clause.fuzzyDistance || 2;
    
    const allTerms = this.indexManager.getAllTerms();
    const vocabulary = allTerms.slice(0, 1000); // 限制词汇表大小以提高性能
    
    const suggestions = this.textAnalyzer.generateSuggestions(clause.value, vocabulary, 10);
    
    for (const suggestion of suggestions) {
      const termResults = this.executeTermClause({ ...clause, value: suggestion, type: 'term' });
      for (const [docId, score] of termResults.entries()) {
        const currentScore = results.get(docId) || 0;
        results.set(docId, currentScore + score * 0.7); // 模糊匹配权重较低
      }
    }

    return results;
  }

  /**
   * 生成匹配信息
   */
  private generateMatches(docId: string, clause: QueryClause): SearchMatch[] {
    const document = this.indexManager.getDocument(docId);
    if (!document) return [];

    const matches: SearchMatch[] = [];
    
    for (const [field, text] of document.fields.entries()) {
      const highlights = this.findHighlights(text, clause.value);
      
      if (highlights.length > 0) {
        matches.push({
          field,
          value: text,
          highlights,
          score: highlights.length * 0.1
        });
      }
    }

    return matches;
  }

  /**
   * 查找文本中的高亮位置
   */
  private findHighlights(text: string, term: string): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    
    let index = 0;
    while ((index = lowerText.indexOf(lowerTerm, index)) !== -1) {
      highlights.push({
        start: index,
        end: index + term.length,
        text: text.substring(index, index + term.length),
        type: 'exact'
      });
      index += term.length;
    }

    return highlights;
  }

  /**
   * 检查是否通过筛选器
   */
  private passesFilters(repository: GitHubRepository, filters: any): boolean {
    if (filters.language && repository.language !== filters.language) {
      return false;
    }

    if (filters.minStars && repository.stargazers_count < filters.minStars) {
      return false;
    }

    if (filters.maxStars && repository.stargazers_count > filters.maxStars) {
      return false;
    }

    if (filters.showArchived === false && repository.archived) {
      return false;
    }

    if (filters.showForks === false && repository.fork) {
      return false;
    }

    // 日期范围筛选
    if (filters.dateRange) {
      const { field, start, end } = filters.dateRange;
      let targetDate: Date;
      
      if (field === 'created') {
        targetDate = new Date(repository.created_at);
      } else if (field === 'updated') {
        targetDate = new Date(repository.updated_at);
      } else {
        return true; // 未知字段，跳过筛选
      }

      if (start && targetDate < start) {
        return false;
      }

      if (end && targetDate > end) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算相关性因子
   */
  private calculateRelevanceFactors(document: any, query: ParsedQuery): RelevanceFactor[] {
    const factors: RelevanceFactor[] = [];

    // 名称匹配因子
    const nameMatches = query.clauses.some(clause => 
      document.fields.get('name')?.toLowerCase().includes(clause.value)
    );
    if (nameMatches) {
      factors.push({
        factor: 'name_match',
        weight: 2.0,
        contribution: 0.3,
        description: '仓库名称匹配'
      });
    }

    // 描述匹配因子
    const descMatches = query.clauses.some(clause =>
      document.fields.get('description')?.toLowerCase().includes(clause.value)
    );
    if (descMatches) {
      factors.push({
        factor: 'description_match',
        weight: 1.5,
        contribution: 0.2,
        description: '描述匹配'
      });
    }

    // 主题匹配因子
    const topicMatches = query.clauses.some(clause =>
      document.fields.get('topics')?.toLowerCase().includes(clause.value)
    );
    if (topicMatches) {
      factors.push({
        factor: 'topic_match',
        weight: 1.8,
        contribution: 0.25,
        description: '主题标签匹配'
      });
    }

    return factors;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(score: number, matches: SearchMatch[]): number {
    const baseConfidence = Math.min(score / 10, 1.0);
    const matchBonus = Math.min(matches.length * 0.1, 0.3);
    return Math.min(baseConfidence + matchBonus, 1.0);
  }

  /**
   * 计算建议分数
   */
  private calculateSuggestionScore(suggestion: string, input: string): number {
    const inputLower = input.toLowerCase();
    const suggestionLower = suggestion.toLowerCase();
    
    if (suggestionLower.startsWith(inputLower)) {
      return 1.0;
    }
    
    if (suggestionLower.includes(inputLower)) {
      return 0.8;
    }
    
    // 基于编辑距离的相似度
    const similarity = this.textAnalyzer.calculateSimilarity(input, suggestion);
    return similarity;
  }

  /**
   * 排序搜索结果
   */
  private sortResults(results: SearchResult[], options: SearchOptions): void {
    const sortBy = options.sortBy || 'relevance';
    const sortOrder = options.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'name':
          comparison = a.repository.name.localeCompare(b.repository.name);
          break;
        case 'stars':
          comparison = a.repository.stargazers_count - b.repository.stargazers_count;
          break;
        case 'updated':
          comparison = new Date(a.repository.updated_at).getTime() - new Date(b.repository.updated_at).getTime();
          break;
        case 'created':
          comparison = new Date(a.repository.created_at).getTime() - new Date(b.repository.created_at).getTime();
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}