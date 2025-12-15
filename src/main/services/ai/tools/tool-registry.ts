/**
 * 工具注册中心
 * 管理所有可用的 AI 工具
 */

import { logger } from '@main/utils/logger';
import type { ITool, IToolRegistry, ToolCall, ToolDefinition, ToolResult } from './types';

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ITool> = new Map();

  /**
   * 注册工具
   */
  register(tool: ITool): void {
    const name = tool.definition.name;
    if (this.tools.has(name)) {
      logger.warn(`Tool ${name} is already registered, overwriting`);
    }
    this.tools.set(name, tool);
    logger.debug(`Tool registered: ${name}`);
  }

  /**
   * 获取工具
   */
  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具定义（用于 LLM）
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => tool.definition);
  }

  /**
   * 执行工具调用
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.get(toolCall.name);

    if (!tool) {
      const error = `Tool not found: ${toolCall.name}`;
      logger.error(error);
      return {
        toolCallId: toolCall.id,
        result: null,
        error,
      };
    }

    try {
      logger.debug(`Executing tool: ${toolCall.name}`, toolCall.arguments);
      const result = await tool.execute(toolCall.arguments);
      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool execution failed: ${toolCall.name}`, error);
      return {
        toolCallId: toolCall.id,
        result: null,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量执行工具调用
   */
  async executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map(call => this.execute(call)));
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
    logger.debug('All tools cleared');
  }

  /**
   * 获取工具数量
   */
  get size(): number {
    return this.tools.size;
  }
}

// 全局工具注册中心实例
export const toolRegistry = new ToolRegistry();
