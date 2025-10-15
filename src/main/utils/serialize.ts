/**
 * 序列化工具函数
 * 用于序列化复杂对象中的日期字段
 */

/**
 * 递归序列化对象中的所有 Date 对象为 ISO 字符串
 */
export function serializeDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result;
  }

  return obj;
}
