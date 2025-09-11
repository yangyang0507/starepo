/**
 * 文本分析器 - 负责文本标记化、规范化和预处理
 */

import type { Token, TokenType } from './types';

export class TextAnalyzer {
  private stopWords: Set<string>;
  private stemmerCache: Map<string, string>;

  constructor() {
    this.stopWords = new Set([
      // 英文停用词
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'she', 'do', 'how', 'their',
      'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some',
      'her', 'would', 'make', 'like', 'into', 'him', 'time', 'two', 'more',
      'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
      'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get',
      'come', 'made', 'may', 'part',
      
      // 编程相关停用词
      'api', 'lib', 'framework', 'tool', 'utils', 'util',
      'helper', 'helpers', 'common', 'core', 'base', 'main', 'index',
      'src', 'source', 'code', 'app', 'application', 'project', 'repo',
      'repository', 'package', 'module', 'component', 'service', 'client'
    ]);
    
    this.stemmerCache = new Map();
  }

  /**
   * 将文本标记化为tokens
   */
  tokenize(text: string, field: string = 'content'): Token[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const tokens: Token[] = [];
    let position = 0;

    // 使用正则表达式分割文本
    const tokenRegex = /\b\w+\b|\d+|\S/g;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      const tokenText = match[0];
      const tokenType = this.getTokenType(tokenText);

      tokens.push({
        text: tokenText,
        normalized: this.normalize(tokenText),
        position: position++,
        field,
        type: tokenType
      });
    }

    return tokens;
  }

  /**
   * 规范化token
   */
  normalize(token: string): string {
    if (!token) return '';

    // 转换为小写
    let normalized = token.toLowerCase();

    // 移除特殊字符（保留字母数字和连字符）
    normalized = normalized.replace(/[^\w-]/g, '');

    // 处理编程语言特殊情况
    normalized = this.handleProgrammingTerms(normalized);

    return normalized;
  }

  /**
   * 处理编程相关术语的特殊规范化
   */
  private handleProgrammingTerms(term: string): string {
    // 编程语言名称标准化
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'c++',
      'csharp': 'c#',
      'cs': 'c#',
      'golang': 'go',
      'nodejs': 'nodejs',
      'reactjs': 'reactjs',
      'vuejs': 'vue',
      'angularjs': 'angular'
    };

    // 常见缩写扩展
    const abbreviationMap: Record<string, string> = {
      'ui': 'user-interface',
      'ux': 'user-experience',
      'api': 'application-programming-interface',
      'cli': 'command-line-interface',
      'gui': 'graphical-user-interface',
      'db': 'database',
      'ai': 'artificial-intelligence',
      'ml': 'machine-learning',
      'dl': 'deep-learning',
      'nlp': 'natural-language-processing'
    };

    return languageMap[term] || abbreviationMap[term] || term;
  }

  /**
   * 词干提取（简化版）
   */
  stem(token: string): string {
    if (this.stemmerCache.has(token)) {
      return this.stemmerCache.get(token)!;
    }

    let stemmed = token;

    // 简单的英文词干提取规则
    if (token.length > 3) {
      // 移除常见后缀（按长度排序，优先处理长后缀）
      const suffixes = [
        'tion', 'sion', 'ness', 'ment', 'able', 'ible', 'ous', 'ive', 'ize', 'ise',
        'ing', 'ed', 'er', 'est', 'ly', 'ful', 'less'
      ];

      for (const suffix of suffixes) {
        if (token.endsWith(suffix) && token.length > suffix.length + 2) {
          stemmed = token.slice(0, -suffix.length);
          
          // 特殊处理：如果移除ing后以nn结尾，去掉一个n
          if (suffix === 'ing' && stemmed.endsWith('nn') && stemmed.length > 3) {
            stemmed = stemmed.slice(0, -1);
          }
          
          break;
        }
      }

      // 处理复数形式
      if (stemmed.endsWith('s') && stemmed.length > 3 && !stemmed.endsWith('ss')) {
        stemmed = stemmed.slice(0, -1);
      }
    }

    this.stemmerCache.set(token, stemmed);
    return stemmed;
  }

  /**
   * 移除停用词
   */
  removeStopWords(tokens: Token[]): Token[] {
    return tokens.filter(token => 
      !this.stopWords.has(token.normalized) && 
      token.normalized.length > 1 &&
      token.type === 'word'
    );
  }

  /**
   * 提取N-gram
   */
  extractNGrams(tokens: Token[], n: number = 2): string[] {
    if (tokens.length < n) return [];

    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens
        .slice(i, i + n)
        .map(token => token.normalized)
        .join(' ');
      ngrams.push(ngram);
    }

    return ngrams;
  }

  /**
   * 计算文本相似度（Jaccard相似度）
   */
  calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenize(text1).map(t => t.normalized));
    const tokens2 = new Set(this.tokenize(text2).map(t => t.normalized));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * 生成模糊搜索建议
   */
  generateFuzzySuggestions(input: string, vocabulary: string[], maxDistance: number = 2, limit: number = 5): Array<{ text: string; distance: number }> {
    if (!input || input.length < 2) return [];

    const suggestions: Array<{ text: string; distance: number; score: number }> = [];
    const inputLower = input.toLowerCase();

    for (const term of vocabulary) {
      const termLower = term.toLowerCase();
      
      // 前缀匹配 - 最高优先级
      if (termLower.startsWith(inputLower)) {
        suggestions.push({ 
          text: term, 
          distance: 0, 
          score: 1.0 
        });
        continue;
      }

      // 包含匹配
      if (termLower.includes(inputLower)) {
        suggestions.push({ 
          text: term, 
          distance: 0, 
          score: 0.9 
        });
        continue;
      }

      // 编辑距离匹配
      const distance = this.calculateEditDistance(inputLower, termLower);
      if (distance <= maxDistance) {
        const score = 1 - (distance / Math.max(inputLower.length, termLower.length));
        suggestions.push({ 
          text: term, 
          distance, 
          score 
        });
      }
    }

    return suggestions
      .sort((a, b) => {
        // 先按距离排序，再按分数排序
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return b.score - a.score;
      })
      .slice(0, limit)
      .map(({ text, distance }) => ({ text, distance }));
  }

  /**
   * 计算编辑距离（Levenshtein距离）
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 确定token类型
   */
  private getTokenType(token: string): TokenType {
    if (/^\d+$/.test(token)) {
      return 'number';
    }
    if (/^\w+$/.test(token)) {
      return 'word';
    }
    if (/^\s+$/.test(token)) {
      return 'whitespace';
    }
    return 'symbol';
  }

  /**
   * 提取关键词（基于TF-IDF的简化版本）
   */
  extractKeywords(text: string, maxKeywords: number = 10): Array<{ term: string; score: number }> {
    const tokens = this.removeStopWords(this.tokenize(text));
    const termFreq = new Map<string, number>();

    // 计算词频
    for (const token of tokens) {
      const term = this.stem(token.normalized);
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    // 简单的关键词评分（基于词频和词长）
    const keywords = Array.from(termFreq.entries())
      .map(([term, freq]) => ({
        term,
        score: freq * Math.log(term.length + 1) // 长词获得更高分数
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxKeywords);

    return keywords;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.stemmerCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.stemmerCache.size,
      hitRate: 0 // 简化实现，实际应该跟踪命中率
    };
  }
}