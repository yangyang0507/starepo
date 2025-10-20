/**
 * Shell API - 处理外部链接和文件系统操作
 */

import type { APIResponse } from '@shared/types';

export const shellAPI = {
  /**
   * 在用户的默认浏览器中打开外部链接
   */
  async openExternal(url: string): Promise<APIResponse> {
    try {
      if (!window.electronAPI?.shell?.openExternal) {
        console.warn('Shell API 不可用，使用备用方案');
        window.open(url, '_blank', 'noopener,noreferrer');
        return { success: true };
      }

      const result = await window.electronAPI.shell.openExternal(url);
      
      if (!result.success) {
        console.error('Shell API 调用失败:', result.error);
        // 备用方案
        window.open(url, '_blank', 'noopener,noreferrer');
        return { success: true };
      }

      return result;
    } catch (error) {
      console.error('打开外部链接时发生错误:', error);
      // 最后的备用方案
      window.open(url, '_blank', 'noopener,noreferrer');
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  },

  /**
   * 打开文件路径
   */
  async openPath(path: string): Promise<APIResponse<string>> {
    try {
      if (!window.electronAPI?.shell?.openPath) {
        throw new Error('Shell API 不可用');
      }

      return await window.electronAPI.shell.openPath(path);
    } catch (error) {
      console.error('打开路径时发生错误:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  },

  /**
   * 在文件管理器中显示文件
   */
  async showItemInFolder(fullPath: string): Promise<APIResponse> {
    try {
      if (!window.electronAPI?.shell?.showItemInFolder) {
        throw new Error('Shell API 不可用');
      }

      return await window.electronAPI.shell.showItemInFolder(fullPath);
    } catch (error) {
      console.error('显示文件时发生错误:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  },
};

