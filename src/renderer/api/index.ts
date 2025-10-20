/**
 * 渲染进程 API 服务层 - 统一导出点
 * 重构后：模块化设计，每个功能独立文件
 */

// 重新导出各个模块的API
export { windowAPI } from './window';
export { themeAPI } from './theme';
export { languageAPI } from './language';
export { githubAPI } from './github';
export { enhancedAuthAPI } from './enhanced-auth';
export { searchAPI } from './search';
export { shellAPI } from './shell';

// 重新导出共享类型
export type { GitHubRepository } from "@shared/types";
export type { AuthState, TokenValidationResult, GitHubUser } from "@shared/types/auth";
