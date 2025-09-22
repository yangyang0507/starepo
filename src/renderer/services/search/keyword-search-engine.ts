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
  SearchSuggestion,
  SearchExplanation,
  ISearchEngine,
  ParsedQuery,
  QueryClause,
  ExplanationStep,
  SearchFilters,
  RelevanceFactor,
  IndexedDocument
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
    const suggestions = this.textAnalyzer.generateFuzzySuggestions(input, vocabulary, 2, limit);

    return suggestions.map(suggestion => ({
      text: suggestion.text,
      type: 'completion' as const,
      score: this.calculateSuggestionScore(suggestion.text, input)
    }));
  }

  /**
   * 获取搜索统计信息
   */
  async getStats(): Promise<SearchPerformanceStats> {
    const indexStats = this.indexManager.getIndexStats();

    return {
      totalResults: indexStats.totalDocuments,
      searchTime: 0, // 需要在实际搜索中计算
      indexSize: indexStats.totalTerms,
      cacheHitRate: 0, // 未来实现缓存时添加
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
   * 解析搜索查询 - 支持高级搜索语法
   */
  private parseQuery(queryText: string, options?: SearchOptions): ParsedQuery {
    const clauses: QueryClause[] = [];
    const caseSensitive = options?.caseSensitive || false;
    
    // 处理逻辑运算符和分组
    const tokens = this.tokenizeAdvancedQuery(queryText);
    
    for (const token of tokens) {
      if (token.startsWith('"') && token.endsWith('"')) {
        // 精确短语搜索
        const phrase = token.slice(1, -1);
        clauses.push({
          type: 'phrase',
          value: caseSensitive ? phrase : phrase.toLowerCase(),
          operator: 'AND'
        });
      } else if (token.includes(':')) {
        // 字段搜索 (field:value)
        const [field, value] = token.split(':', 2);
        
        // 处理范围搜索 (stars:>1000, updated:<2024)
        if (value.match(/^[><]=?\d+$/)) {
          clauses.push({
            type: 'range',
            field: field.toLowerCase(),
            value: value,
            operator: 'AND'
          });
        } else {
          clauses.push({
            type: 'field',
            field: field.toLowerCase(),
            value: caseSensitive ? value : value.toLowerCase(),
            operator: 'AND'
          });
        }
      } else if (token === 'AND' || token === 'OR' || token === 'NOT') {
        // 设置逻辑运算符
        if (clauses.length > 0) {
          clauses[clauses.length - 1].operator = token;
        }
      } else if (token.includes('*')) {
        // 通配符搜索
        clauses.push({
          type: 'wildcard',
          value: caseSensitive ? token : token.toLowerCase(),
          operator: 'AND'
        });
      } else if (token.includes('~')) {
        // 模糊搜索
        const [value, distance] = token.split('~');
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
          value: caseSensitive ? token : token.toLowerCase(),
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
   * 高级查询标记化
   */
  private tokenizeAdvancedQuery(queryText: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';
    let inQuotes = false;
    
    for (let i = 0; i < queryText.length; i++) {
      const char = queryText[i];
      
      if (char === '"') {
        if (inQuotes) {
          // 结束引号
          tokens.push('"' + currentToken + '"');
          currentToken = '';
          inQuotes = false;
        } else {
          // 开始引号
          if (currentToken) {
            tokens.push(currentToken);
            currentToken = '';
          }
          inQuotes = true;
        }
      } else if (char === ' ' && !inQuotes) {
        // 空格分隔符（不在引号内）
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else {
        currentToken += char;
      }
    }
    
    // 添加最后一个token
    if (currentToken) {
      if (inQuotes) {
        tokens.push('"' + currentToken + '"');
      } else {
        tokens.push(currentToken);
      }
    }
    
    return tokens;
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

    // 如果没有查询子句但需要筛选，包含所有文档
    if (parsedQuery.clauses.length === 0 && parsedQuery.filters) {
      for (const docId of this.indexManager['index'].documents.keys()) {
        candidateDocuments.set(docId, 1.0); // 基础分数
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
      
      case 'phrase':
        return this.executePhraseClause(clause);
      
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
   * 执行短语查询
   */
  private executePhraseClause(clause: QueryClause): Map<string, number> {
    const results = new Map<string, number>();
    const phrase = clause.value;
    const phraseTokens = phrase.split(/\s+/);
    
    // 获取所有包含短语中每个词的文档
    const documentSets: Map<string, number>[] = [];
    
    for (const token of phraseTokens) {
      const tokenResults = this.executeTermClause({ ...clause, value: token, type: 'term' });
      documentSets.push(tokenResults);
    }
    
    // 找出同时包含所有词的文档
    const commonDocuments = new Set(documentSets[0].keys());
    
    for (let i = 1; i < documentSets.length; i++) {
      const currentDocs = new Set(documentSets[i].keys());
      for (const docId of commonDocuments) {
        if (!currentDocs.has(docId)) {
          commonDocuments.delete(docId);
        }
      }
    }
    
    // 计算短语匹配分数
    for (const docId of commonDocuments) {
      let phraseScore = 0;
      
      // 累加各词的分数
      for (const docSet of documentSets) {
        phraseScore += (docSet.get(docId) || 0);
      }
      
      // 短语匹配获得额外权重
      results.set(docId, phraseScore * 1.5 * (clause.boost || 1.0));
    }

    return results;
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
      for (const [, boost] of posting.fieldBoosts.entries()) {
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
    const vocabulary = allTerms.slice(0, 500); // 限制词汇表大小以优化性能
    
    // 使用改进的模糊建议生成
    const suggestions = this.textAnalyzer.generateFuzzySuggestions(
      clause.value, 
      vocabulary, 
      maxDistance,
      5 // 限制建议数量
    );
    
    for (const suggestion of suggestions) {
      // 计算模糊匹配的相似度分数
      const similarity = this.textAnalyzer.calculateSimilarity(clause.value, suggestion.text);
      const similarityScore = Math.max(0.1, similarity); // 确保最小分数
      
      const termResults = this.executeTermClause({ ...clause, value: suggestion.text, type: 'term' });
      
      for (const [docId, score] of termResults.entries()) {
        const currentScore = results.get(docId) || 0;
        // 基于相似度的加权分数
        const weightedScore = score * similarityScore * 0.6;
        results.set(docId, currentScore + weightedScore);
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
    
    // 根据子句类型生成不同的匹配信息
    for (const [, text] of document.fields.entries()) {
      let highlights: TextHighlight[] = [];
      
      switch (clause.type) {
        case 'phrase':
          highlights = this.findPhraseHighlights(text, clause.value);
          break;
          
        case 'fuzzy':
          highlights = this.findHighlights(text, clause.value, true);
          break;
          
        case 'term':
        case 'field':
        case 'wildcard':
        default:
          highlights = this.findHighlights(text, clause.value);
          break;
      }
      
      if (highlights.length > 0) {
        matches.push({
          field: '', // 字段将在外部设置
          value: text,
          highlights,
          score: this.calculateMatchScore(clause, highlights)
        });
      }
    }

    return matches;
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(clause: QueryClause, highlights: TextHighlight[]): number {
    let baseScore = highlights.length * 0.1;
    
    // 根据匹配类型调整分数
    switch (clause.type) {
      case 'phrase':
        baseScore *= 1.5; // 短语匹配权重更高
        break;
      case 'field':
        baseScore *= 1.8; // 字段匹配权重最高
        break;
      case 'fuzzy':
        baseScore *= 0.7; // 模糊匹配权重较低
        break;
    }
    
    // 应用boost参数
    if (clause.boost) {
      baseScore *= clause.boost;
    }
    
    return baseScore;
  }

  /**
   * 查找文本中的高亮位置
   */
  private findHighlights(text: string, term: string, isFuzzy: boolean = false): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    
    // 精确匹配
    let index = 0;
    while ((index = lowerText.indexOf(lowerTerm, index)) !== -1) {
      highlights.push({
        start: index,
        end: index + term.length,
        text: text.substring(index, index + term.length),
        type: isFuzzy ? 'fuzzy' : 'exact'
      });
      index += term.length;
    }

    // 如果找不到精确匹配，尝试模糊匹配
    if (highlights.length === 0 && isFuzzy) {
      const words = text.split(/\s+/);
      let position = 0;
      
      for (const word of words) {
        if (this.textAnalyzer.calculateSimilarity(term, word) > 0.6) {
          const wordIndex = text.indexOf(word, position);
          if (wordIndex !== -1) {
            highlights.push({
              start: wordIndex,
              end: wordIndex + word.length,
              text: word,
              type: 'fuzzy'
            });
            position = wordIndex + word.length;
          }
        }
      }
    }

    return highlights;
  }

  /**
   * 查找短语匹配
   */
  private findPhraseHighlights(text: string, phrase: string): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const lowerText = text.toLowerCase();
    const lowerPhrase = phrase.toLowerCase();
    
    let index = 0;
    while ((index = lowerText.indexOf(lowerPhrase, index)) !== -1) {
      highlights.push({
        start: index,
        end: index + phrase.length,
        text: text.substring(index, index + phrase.length),
        type: 'exact'
      });
      index += phrase.length;
    }

    return highlights;
  }

  /**
   * 检查是否通过筛选器
   */
  private passesFilters(repository: GitHubRepository, filters: SearchFilters): boolean {
    // 基础筛选器
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
   * 获取字段值
   */
  private getFieldValue(repository: GitHubRepository, field: string): string | number | Date {
    switch (field) {
      case 'name':
        return repository.name;
      case 'description':
        return repository.description || '';
      case 'language':
        return repository.language || '';
      case 'owner':
        return repository.owner.login;
      case 'stars':
        return repository.stargazers_count;
      case 'forks':
        return repository.forks_count;
      case 'issues':
        return repository.open_issues_count;
      case 'created':
        return new Date(repository.created_at);
      case 'updated':
        return new Date(repository.updated_at);
      case 'pushed':
        return new Date(repository.pushed_at);
      case 'archived':
        return repository.archived;
      case 'fork':
        return repository.fork;
      default:
        // 尝试从 topics 中查找
        if (repository.topics?.includes(field)) {
          return field;
        }
        return null;
    }
  }

  /**
   * 比较值（支持字符串、数字、日期）
   */
  private compareValues(a: string | number | Date, b: string | number | Date): number {
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }
    
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }
    
    // 尝试转换为数字比较
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // 默认字符串比较
    return String(a).localeCompare(String(b));
  }

  /**
   * 计算相关性因子
   */
  private calculateRelevanceFactors(document: IndexedDocument, query: ParsedQuery): RelevanceFactor[] {
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