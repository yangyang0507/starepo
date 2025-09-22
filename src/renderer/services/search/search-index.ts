/**
 * 搜索索引管理器 - 负责构建和维护搜索索引
 */

import type { GitHubRepository } from '@/services/github/types';
import type {
  SearchIndex,
  IndexedDocument,
  PostingList,
  Token,
  IndexMetadata,
  FieldStatistics,
  FieldWeights
} from './types';
import { TextAnalyzer } from './text-analyzer';

export class SearchIndexManager {
  private index: SearchIndex;
  private textAnalyzer: TextAnalyzer;
  private fieldWeights: FieldWeights;

  constructor(fieldWeights?: FieldWeights) {
    this.textAnalyzer = new TextAnalyzer();
    this.fieldWeights = fieldWeights || {
      name: 2.0,
      description: 1.5,
      topics: 1.8,
      owner: 1.2,
      readme: 1.0
    };

    this.index = {
      documents: new Map(),
      invertedIndex: new Map(),
      fieldIndex: new Map(),
      metadata: {
        totalDocuments: 0,
        totalTerms: 0,
        averageDocumentLength: 0,
        fieldStatistics: new Map(),
        createdAt: new Date(),
        lastUpdated: new Date()
      }
    };
  }

  /**
   * 构建完整索引
   */
  async buildIndex(repositories: GitHubRepository[]): Promise<void> {
    console.log(`开始构建搜索索引，共 ${repositories.length} 个仓库`);
    const startTime = Date.now();

    // 清空现有索引
    this.clearIndex();

    // 批量处理仓库
    const batchSize = 100;
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      await this.processBatch(batch);
      
      // 报告进度
      if (i % (batchSize * 5) === 0) {
        console.log(`索引进度: ${i + batch.length}/${repositories.length}`);
      }
    }

    // 更新元数据
    this.updateIndexMetadata();

    const endTime = Date.now();
    console.log(`索引构建完成，用时 ${endTime - startTime}ms`);
  }

  /**
   * 处理仓库批次
   */
  private async processBatch(repositories: GitHubRepository[]): Promise<void> {
    for (const repo of repositories) {
      await this.addDocument(repo);
    }
  }

  /**
   * 添加文档到索引
   */
  async addDocument(repository: GitHubRepository): Promise<void> {
    const docId = repository.id.toString();
    
    // 提取可搜索文本
    const searchableFields = this.extractSearchableFields(repository);
    
    // 生成tokens
    const allTokens: Token[] = [];
    const fieldLengths = new Map<string, number>();
    const termFrequencies = new Map<string, number>();

    for (const [field, text] of searchableFields.entries()) {
      const tokens = this.textAnalyzer.tokenize(text, field);
      const filteredTokens = this.textAnalyzer.removeStopWords(tokens);
      
      allTokens.push(...filteredTokens);
      fieldLengths.set(field, filteredTokens.length);

      // 计算词频
      for (const token of filteredTokens) {
        const term = this.textAnalyzer.stem(token.normalized);
        termFrequencies.set(term, (termFrequencies.get(term) || 0) + 1);
      }
    }

    // 创建索引文档
    const indexedDoc: IndexedDocument = {
      id: docId,
      fields: searchableFields,
      tokens: allTokens,
      metadata: {
        repository,
        searchableText: Array.from(searchableFields.values()).join(' '),
        fieldLengths,
        termFrequencies
      },
      lastUpdated: new Date()
    };

    // 添加到文档索引
    this.index.documents.set(docId, indexedDoc);

    // 更新倒排索引
    this.updateInvertedIndex(docId, allTokens);

    // 更新字段索引
    this.updateFieldIndex(docId, searchableFields);
  }

  /**
   * 提取可搜索字段
   */
  private extractSearchableFields(repository: GitHubRepository): Map<string, string> {
    const fields = new Map<string, string>();

    // 仓库名称
    if (repository.name) {
      fields.set('name', repository.name);
    }

    // 描述
    if (repository.description) {
      fields.set('description', repository.description);
    }

    // 主题标签
    if (repository.topics && repository.topics.length > 0) {
      fields.set('topics', repository.topics.join(' '));
    }

    // 所有者
    if (repository.owner?.login) {
      fields.set('owner', repository.owner.login);
    }

    // 语言
    if (repository.language) {
      fields.set('language', repository.language);
    }

    // 组合搜索文本（用于全文搜索）
    const combinedText = [
      repository.name,
      repository.description,
      repository.topics?.join(' '),
      repository.owner?.login,
      repository.language
    ].filter(Boolean).join(' ');

    fields.set('all', combinedText);

    return fields;
  }

  /**
   * 更新倒排索引
   */
  private updateInvertedIndex(docId: string, tokens: Token[]): void {
    const termPositions = new Map<string, number[]>();

    // 收集每个词项的位置信息
    for (const token of tokens) {
      const term = this.textAnalyzer.stem(token.normalized);
      if (!termPositions.has(term)) {
        termPositions.set(term, []);
      }
      termPositions.get(term)!.push(token.position);
    }

    // 更新倒排索引
    for (const [term, positions] of termPositions.entries()) {
      if (!this.index.invertedIndex.has(term)) {
        this.index.invertedIndex.set(term, {
          term,
          documentFrequency: 0,
          postings: []
        });
      }

      const postingList = this.index.invertedIndex.get(term)!;
      
      // 检查是否已存在该文档的posting
      let posting = postingList.postings.find(p => p.documentId === docId);
      if (!posting) {
        posting = {
          documentId: docId,
          termFrequency: 0,
          positions: [],
          fieldBoosts: new Map()
        };
        postingList.postings.push(posting);
        postingList.documentFrequency++;
      }

      posting.termFrequency = positions.length;
      posting.positions = positions;

      // 计算字段权重
      const fieldBoosts = new Map<string, number>();
      for (const token of tokens) {
        if (this.textAnalyzer.stem(token.normalized) === term) {
          const currentBoost = fieldBoosts.get(token.field) || 0;
          const fieldWeight = this.fieldWeights[token.field as keyof FieldWeights] || 1.0;
          fieldBoosts.set(token.field, currentBoost + fieldWeight);
        }
      }
      posting.fieldBoosts = fieldBoosts;
    }
  }

  /**
   * 更新字段索引
   */
  private updateFieldIndex(docId: string, fields: Map<string, string>): void {
    for (const [fieldName, fieldValue] of fields.entries()) {
      if (!this.index.fieldIndex.has(fieldName)) {
        this.index.fieldIndex.set(fieldName, new Map());
      }

      const fieldIndex = this.index.fieldIndex.get(fieldName)!;
      const tokens = this.textAnalyzer.removeStopWords(
        this.textAnalyzer.tokenize(fieldValue, fieldName)
      );

      for (const token of tokens) {
        const term = this.textAnalyzer.stem(token.normalized);
        
        if (!fieldIndex.has(term)) {
          fieldIndex.set(term, {
            term,
            documentFrequency: 0,
            postings: []
          });
        }

        const postingList = fieldIndex.get(term)!;
        let posting = postingList.postings.find(p => p.documentId === docId);
        
        if (!posting) {
          posting = {
            documentId: docId,
            termFrequency: 0,
            positions: [],
            fieldBoosts: new Map()
          };
          postingList.postings.push(posting);
          postingList.documentFrequency++;
        }

        posting.termFrequency++;
        posting.positions.push(token.position);
      }
    }
  }

  /**
   * 更新文档
   */
  async updateDocument(repository: GitHubRepository): Promise<void> {
    const docId = repository.id.toString();
    
    // 如果文档已存在，先删除
    if (this.index.documents.has(docId)) {
      await this.removeDocument(docId);
    }
    
    // 重新添加文档
    await this.addDocument(repository);
  }

  /**
   * 删除文档
   */
  async removeDocument(docId: string): Promise<void> {
    const doc = this.index.documents.get(docId);
    if (!doc) return;

    // 从倒排索引中移除
    for (const token of doc.tokens) {
      const term = this.textAnalyzer.stem(token.normalized);
      const postingList = this.index.invertedIndex.get(term);
      
      if (postingList) {
        postingList.postings = postingList.postings.filter(p => p.documentId !== docId);
        postingList.documentFrequency = postingList.postings.length;
        
        // 如果没有文档包含该词项，删除整个posting list
        if (postingList.postings.length === 0) {
          this.index.invertedIndex.delete(term);
        }
      }
    }

    // 从字段索引中移除
    for (const [_fieldName, fieldIndex] of this.index.fieldIndex.entries()) {
      for (const [term, postingList] of fieldIndex.entries()) {
        postingList.postings = postingList.postings.filter(p => p.documentId !== docId);
        postingList.documentFrequency = postingList.postings.length;
        
        if (postingList.postings.length === 0) {
          fieldIndex.delete(term);
        }
      }
    }

    // 从文档索引中移除
    this.index.documents.delete(docId);

    // 更新元数据
    this.updateIndexMetadata();
  }

  /**
   * 获取词项的posting list
   */
  getPostingList(term: string): PostingList | undefined {
    const stemmedTerm = this.textAnalyzer.stem(term.toLowerCase());
    return this.index.invertedIndex.get(stemmedTerm);
  }

  /**
   * 获取字段中词项的posting list
   */
  getFieldPostingList(field: string, term: string): PostingList | undefined {
    const fieldIndex = this.index.fieldIndex.get(field);
    if (!fieldIndex) return undefined;
    
    const stemmedTerm = this.textAnalyzer.stem(term.toLowerCase());
    return fieldIndex.get(stemmedTerm);
  }

  /**
   * 获取文档
   */
  getDocument(docId: string): IndexedDocument | undefined {
    return this.index.documents.get(docId);
  }

  /**
   * 获取所有词项
   */
  getAllTerms(): string[] {
    return Array.from(this.index.invertedIndex.keys());
  }

  /**
   * 获取字段的所有词项
   */
  getFieldTerms(field: string): string[] {
    const fieldIndex = this.index.fieldIndex.get(field);
    return fieldIndex ? Array.from(fieldIndex.keys()) : [];
  }

  /**
   * 计算TF-IDF分数
   */
  calculateTfIdf(term: string, docId: string): number {
    const postingList = this.getPostingList(term);
    if (!postingList) return 0;

    const posting = postingList.postings.find(p => p.documentId === docId);
    if (!posting) return 0;

    const tf = posting.termFrequency;
    const df = postingList.documentFrequency;
    const totalDocs = this.index.metadata.totalDocuments;

    // TF-IDF = (1 + log(tf)) * log(N / df)
    const tfScore = 1 + Math.log(tf);
    const idfScore = Math.log(totalDocs / df);

    return tfScore * idfScore;
  }

  /**
   * 获取索引统计信息
   */
  getIndexStats(): IndexMetadata {
    return { ...this.index.metadata };
  }

  /**
   * 更新索引元数据
   */
  private updateIndexMetadata(): void {
    const metadata = this.index.metadata;
    
    metadata.totalDocuments = this.index.documents.size;
    metadata.totalTerms = this.index.invertedIndex.size;
    metadata.lastUpdated = new Date();

    // 计算平均文档长度
    let totalLength = 0;
    for (const doc of this.index.documents.values()) {
      totalLength += doc.tokens.length;
    }
    metadata.averageDocumentLength = metadata.totalDocuments > 0 
      ? totalLength / metadata.totalDocuments 
      : 0;

    // 更新字段统计
    metadata.fieldStatistics.clear();
    for (const [fieldName, fieldIndex] of this.index.fieldIndex.entries()) {
      const stats: FieldStatistics = {
        totalLength: 0,
        averageLength: 0,
        uniqueTerms: fieldIndex.size,
        maxTermFrequency: 0
      };

      for (const postingList of fieldIndex.values()) {
        for (const posting of postingList.postings) {
          stats.totalLength += posting.termFrequency;
          stats.maxTermFrequency = Math.max(stats.maxTermFrequency, posting.termFrequency);
        }
      }

      stats.averageLength = stats.totalLength / Math.max(1, fieldIndex.size);
      metadata.fieldStatistics.set(fieldName, stats);
    }
  }

  /**
   * 清空索引
   */
  private clearIndex(): void {
    this.index.documents.clear();
    this.index.invertedIndex.clear();
    this.index.fieldIndex.clear();
    this.index.metadata = {
      totalDocuments: 0,
      totalTerms: 0,
      averageDocumentLength: 0,
      fieldStatistics: new Map(),
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * 序列化索引（用于持久化）
   */
  serialize(): string {
    const serializable = {
      documents: Array.from(this.index.documents.entries()),
      invertedIndex: Array.from(this.index.invertedIndex.entries()),
      fieldIndex: Array.from(this.index.fieldIndex.entries()).map(([field, index]) => [
        field,
        Array.from(index.entries())
      ]),
      metadata: {
        ...this.index.metadata,
        fieldStatistics: Array.from(this.index.metadata.fieldStatistics.entries())
      }
    };

    return JSON.stringify(serializable);
  }

  /**
   * 反序列化索引（用于加载）
   */
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      this.index.documents = new Map(parsed.documents);
      this.index.invertedIndex = new Map(parsed.invertedIndex);
      
      this.index.fieldIndex = new Map();
      for (const [field, entries] of parsed.fieldIndex) {
        this.index.fieldIndex.set(field, new Map(entries));
      }
      
      this.index.metadata = {
        ...parsed.metadata,
        fieldStatistics: new Map(parsed.metadata.fieldStatistics),
        createdAt: new Date(parsed.metadata.createdAt),
        lastUpdated: new Date(parsed.metadata.lastUpdated)
      };
    } catch (error) {
      console.error('索引反序列化失败:', error);
      this.clearIndex();
    }
  }
}