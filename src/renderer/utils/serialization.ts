/**
 * 序列化工具函数 - 渲染进程版本
 * 用于处理前端的对象序列化和反序列化
 */

/**
 * 反序列化字符串为 Date 对象（递归）
 */
export function deserializeDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // 简单的 ISO 日期字符串检测
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (isoDateRegex.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deserializeDates);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deserializeDates(value);
    }
    return result;
  }

  return obj;
}
