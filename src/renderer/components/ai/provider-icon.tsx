/**
 * Provider 图标组件
 * 统一管理预定义和自定义 Provider 的图标显示
 * 支持通过 providerId 或 iconId 从 @lobehub/icons 渲染
 */

import type { ComponentType } from 'react';
import OpenAI from '@lobehub/icons/es/OpenAI';
import Anthropic from '@lobehub/icons/es/Anthropic';
import DeepSeek from '@lobehub/icons/es/DeepSeek';
import Ai21 from '@lobehub/icons/es/Ai21';
import AlibabaCloud from '@lobehub/icons/es/AlibabaCloud';
import Aws from '@lobehub/icons/es/Aws';
import Bedrock from '@lobehub/icons/es/Bedrock';
import Anyscale from '@lobehub/icons/es/Anyscale';
import Azure from '@lobehub/icons/es/Azure';
import AzureAI from '@lobehub/icons/es/AzureAI';
import Baichuan from '@lobehub/icons/es/Baichuan';
import Bailian from '@lobehub/icons/es/Bailian';
import ChatGLM from '@lobehub/icons/es/ChatGLM';
import Coze from '@lobehub/icons/es/Coze';
import Doubao from '@lobehub/icons/es/Doubao';
import Google from '@lobehub/icons/es/Google';
import Groq from '@lobehub/icons/es/Groq';
import HuggingFace from '@lobehub/icons/es/HuggingFace';
import Kimi from '@lobehub/icons/es/Kimi';
import LmStudio from '@lobehub/icons/es/LmStudio';
import Minimax from '@lobehub/icons/es/Minimax';
import Mistral from '@lobehub/icons/es/Mistral';
import Moonshot from '@lobehub/icons/es/Moonshot';
import Perplexity from '@lobehub/icons/es/Perplexity';
import Poe from '@lobehub/icons/es/Poe';
import Qwen from '@lobehub/icons/es/Qwen';
import Together from '@lobehub/icons/es/Together';
import XAI from '@lobehub/icons/es/XAI';
import Zhipu from '@lobehub/icons/es/Zhipu';
import { providerMappings } from '@lobehub/icons/es/features/providerConfig';
import type { AIProviderId } from '@shared/types';

interface ProviderIconProps {
  providerId?: AIProviderId;
  iconId?: string; // iconId from providerMappings (用于自定义 Provider)
  size?: number;
  className?: string;
  fallbackIcon?: string; // Base64 或 URL（向后兼容）
}

// Provider ID 到图标组件的映射（预定义 Provider）
const PROVIDER_ICON_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  openai: OpenAI,
  anthropic: Anthropic,
  deepseek: DeepSeek,
  ai21: Ai21,
  alibaba: AlibabaCloud,
  alibabacloud: AlibabaCloud,
  amazon: Aws,
  aws: Aws,
  anyscale: Anyscale,
  azure: Azure,
  azureai: AzureAI,
  baichuan: Baichuan,
  bailian: Bailian,
  bedrock: Bedrock,
  chatglm: ChatGLM,
  coze: Coze,
  doubao: Doubao,
  google: Google,
  groq: Groq,
  huggingface: HuggingFace,
  kimi: Kimi,
  lmstudio: LmStudio,
  minimax: Minimax,
  mistral: Mistral,
  moonshot: Moonshot,
  perplexity: Perplexity,
  poe: Poe,
  qwen: Qwen,
  together: Together,
  xai: XAI,
  zhipu: Zhipu,
};

// 从 providerMappings 构建 iconId 到图标的映射
const ICON_ID_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {};
for (const mapping of providerMappings) {
  const iconId = mapping.keywords[0]?.replace('^', '').replace('/', '');
  if (iconId) {
    ICON_ID_MAP[iconId] = mapping.Icon;
  }
}

export function ProviderIcon({
  providerId,
  iconId,
  size = 20,
  className,
  fallbackIcon,
}: ProviderIconProps) {
  // 1. 优先使用 iconId（自定义 Provider）
  if (iconId) {
    const IconComponent = ICON_ID_MAP[iconId];
    if (IconComponent) {
      return <IconComponent size={size} className={className} />;
    }
  }

  // 2. 使用 providerId 查找预定义 Provider
  if (providerId) {
    const IconComponent = PROVIDER_ICON_MAP[providerId];
    if (IconComponent) {
      return <IconComponent size={size} className={className} />;
    }
  }

  // 3. 向后兼容：fallbackIcon（Base64 或 URL）
  if (fallbackIcon) {
    return (
      <img
        src={fallbackIcon}
        alt={providerId || iconId || 'icon'}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 4. 兜底：显示首字母
  const displayId = providerId || iconId || '?';
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        fontWeight: 600,
        background: 'hsl(var(--muted))',
        borderRadius: '50%',
      }}
    >
      {displayId.charAt(0).toUpperCase()}
    </div>
  );
}
