/**
 * 协议选择器组件
 * 选择 API 协议类型（OpenAI、Anthropic、Gemini）
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AI_PROTOCOL, type AIProtocol } from '@shared/types/ai-provider';

interface ProtocolSelectorProps {
  value: AIProtocol;
  onChange: (value: AIProtocol) => void;
  disabled?: boolean;
}

export function ProtocolSelector({
  value,
  onChange,
  disabled = false,
}: ProtocolSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>API 类型</Label>

      <Select
        value={value}
        onValueChange={(val) => onChange(val as AIProtocol)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择 API 类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AI_PROTOCOL.OPENAI_COMPATIBLE}>
            OpenAI
          </SelectItem>
          <SelectItem value={AI_PROTOCOL.ANTHROPIC}>
            Anthropic
          </SelectItem>
          <SelectItem value={AI_PROTOCOL.GEMINI}>
            Gemini
          </SelectItem>
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        选择您的 API 端点使用的协议格式
      </p>
    </div>
  );
}
