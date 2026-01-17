/**
 * 会话元数据类型定义
 */

/**
 * 会话元数据
 */
export interface ConversationMeta {
  /** 会话 ID */
  id: string;
  /** 当前显示的标题 */
  title: string;
  /** 临时标题（从第一条消息截取） */
  tempTitle: string;
  /** 是否已生成智能标题 */
  isTitleGenerated: boolean;
  /** 标题生成状态 */
  status: 'pending' | 'ready' | 'failed';
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
  /** 使用的模型 ID */
  modelId?: string;
  /** 使用的 Provider ID */
  providerId?: string;
  /** 错误信息（如果生成失败） */
  error?: string;
}

/**
 * 生成标题的请求参数
 */
export interface GenerateTitleRequest {
  /** 会话 ID */
  conversationId: string;
  /** 第一条用户消息 */
  firstUserMessage: string;
  /** 第一条助手消息（可选） */
  firstAssistantMessage?: string;
  /** 临时标题 */
  tempTitle: string;
  /** 使用的模型 ID（可选） */
  modelId?: string;
}

/**
 * 生成标题的响应
 */
export interface GenerateTitleResponse {
  /** 会话 ID */
  conversationId: string;
  /** 生成的标题 */
  title: string;
  /** 状态 */
  status: 'ready' | 'failed';
  /** 错误信息 */
  error?: string;
}

/**
 * 会话列表响应
 */
export interface ConversationListResponse {
  /** 会话元数据列表 */
  conversations: ConversationMeta[];
}
