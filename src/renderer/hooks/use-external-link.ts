/**
 * 外部链接处理 Hook
 * 统一处理所有外部链接的打开方式
 */

import { useCallback } from 'react';
import { shellAPI } from '@/api';

/**
 * 使用 shell handler 打开外部链接
 * 
 * @returns 打开外部链接的函数
 */
export function useExternalLink() {
  const openExternal = useCallback(async (url: string) => {
    try {
      await shellAPI.openExternal(url);
    } catch (error) {
      console.error('打开外部链接失败:', error);
    }
  }, []);

  /**
   * 处理点击事件，防止默认行为
   */
  const handleLinkClick = useCallback(
    (url: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openExternal(url);
    },
    [openExternal]
  );

  return {
    openExternal,
    handleLinkClick,
  };
}

