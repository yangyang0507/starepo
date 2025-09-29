import { ipcMain } from 'electron';
import { lancedbSearchService } from '../services/search';
import { SEARCH_CHANNELS } from '../../shared/constants/ipc-channels';
import type { APIResponse } from '../../shared/types/index.js';

/**
 * 搜索相关的 IPC 处理器
 */

// 搜索仓库
ipcMain.handle(SEARCH_CHANNELS.SEARCH_REPOSITORIES, async (_, options: {
  query?: string;
  language?: string;
  minStars?: number;
  maxStars?: number;
  limit?: number;
  sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
}): Promise<APIResponse<{
  repositories: any[];
  totalCount: number;
  searchTime: number;
}>> => {
  try {
    await lancedbSearchService.initialize();
    const result = await lancedbSearchService.searchRepositories(options);

    return {
      success: true,
      data: result,
      message: `找到 ${result.totalCount} 个仓库`
    };
  } catch (error) {
    console.error('搜索仓库失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '搜索失败'
    };
  }
});

// 获取搜索建议
ipcMain.handle(SEARCH_CHANNELS.GET_SEARCH_SUGGESTIONS, async (_, input: string, limit: number = 10): Promise<APIResponse<{
  terms: string[];
  languages: string[];
  topics: string[];
}>> => {
  try {
    await lancedbSearchService.initialize();
    const result = await lancedbSearchService.getSearchSuggestions(input, limit);

    return {
      success: true,
      data: result,
      message: '获取搜索建议成功'
    };
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取搜索建议失败'
    };
  }
});

// 获取热门搜索词
ipcMain.handle(SEARCH_CHANNELS.GET_POPULAR_SEARCH_TERMS, async (_, limit: number = 10): Promise<APIResponse<{
  languages: Array<{ name: string; count: number }>;
  topics: Array<{ name: string; count: number }>;
}>> => {
  try {
    await lancedbSearchService.initialize();
    const result = await lancedbSearchService.getPopularSearchTerms(limit);

    return {
      success: true,
      data: result,
      message: '获取热门搜索词成功'
    };
  } catch (error) {
    console.error('获取热门搜索词失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取热门搜索词失败'
    };
  }
});

// 获取搜索统计
ipcMain.handle(SEARCH_CHANNELS.GET_SEARCH_STATS, async (): Promise<APIResponse<{
  totalRepositories: number;
  totalUsers: number;
  indexSize: number;
}>> => {
  try {
    await lancedbSearchService.initialize();
    const result = await lancedbSearchService.getSearchStats();

    return {
      success: true,
      data: result,
      message: '获取搜索统计成功'
    };
  } catch (error) {
    console.error('获取搜索统计失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取搜索统计失败'
    };
  }
});

console.log('搜索 IPC 处理器已注册');