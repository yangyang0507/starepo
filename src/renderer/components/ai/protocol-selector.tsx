/**
 * 协议选择器组件
 * 选择 API 协议类型（OpenAI Compatible、Anthropic）
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as AIProtocol)}
        disabled={disabled}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={AI_PROTOCOL.OPENAI_COMPATIBLE}
              id="protocol-openai"
            />
            <Label
              htmlFor="protocol-openai"
              className="font-normal cursor-pointer"
            >
              OpenAI 兼容格式
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value={AI_PROTOCOL.ANTHROPIC}
              id="protocol-anthropic"
            />
            <Label
              htmlFor="protocol-anthropic"
              className="font-normal cursor-pointer"
            >
              Anthropic 格式
            </Label>
          </div>
        </div>
      </RadioGroup>

      <p className="text-xs text-muted-foreground">
        选择您的 API 端点使用的协议格式
      </p>
    </div>
  );
}
