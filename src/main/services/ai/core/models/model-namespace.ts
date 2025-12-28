/**
 * 模型命名空间
 * 格式: provider|model 或 provider|namespace:model
 */
export interface ModelNamespace {
  provider: string; // e.g., "openai", "anthropic"
  namespace?: string; // e.g., "gpt-4", "claude" (可选的中间命名空间)
  model: string; // e.g., "gpt-4-turbo", "claude-3-opus"
  raw: string; // 原始字符串
}

/**
 * 解析模型命名空间
 * 支持格式:
 * 1. "openai|gpt-4-turbo"
 * 2. "anthropic|claude-3-opus"
 * 3. "openai|gpt-4:turbo" (带命名空间)
 * 4. "gpt-4-turbo" (仅模型名，需要从上下文推断 provider)
 */
export function parseModelNamespace(input: string): ModelNamespace {
  const parts = input.split('|');

  if (parts.length === 1) {
    // 仅模型名，provider 需要从上下文推断
    return {
      provider: '',
      model: parts[0],
      raw: input,
    };
  }

  if (parts.length === 2) {
    const [provider, modelPart] = parts;
    const namespaceParts = modelPart.split(':');

    if (namespaceParts.length === 2) {
      return {
        provider,
        namespace: namespaceParts[0],
        model: namespaceParts[1],
        raw: input,
      };
    }

    return {
      provider,
      model: modelPart,
      raw: input,
    };
  }

  throw new Error(`Invalid model namespace format: ${input}`);
}

/**
 * 格式化模型命名空间
 */
export function formatModelNamespace(namespace: ModelNamespace): string {
  if (!namespace.provider) {
    return namespace.model;
  }

  if (namespace.namespace) {
    return `${namespace.provider}|${namespace.namespace}:${namespace.model}`;
  }

  return `${namespace.provider}|${namespace.model}`;
}

/**
 * 验证模型命名空间格式
 */
export function isValidModelNamespace(input: string): boolean {
  try {
    parseModelNamespace(input);
    return true;
  } catch {
    return false;
  }
}
