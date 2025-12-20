/**
 * AI Provider 选择器组件
 * 支持多种 Provider 的选择和配置
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIProviderId, ProviderOption, ProviderAccountMetadata } from '@shared/types';

interface ProviderSelectorProps {
  providers: ProviderOption[];
  value: AIProviderId;
  onChange: (providerId: AIProviderId) => void;
  disabled?: boolean;
  configuredProviders?: Map<AIProviderId, ProviderAccountMetadata>;
}

export function ProviderSelector({
  providers,
  value,
  onChange,
  disabled = false,
  configuredProviders = new Map(),
}: ProviderSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">AI 提供商</Label>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as AIProviderId)}
        disabled={disabled}
        className="grid gap-3"
      >
        {providers.map((provider) => {
          const account = configuredProviders.get(provider.value);
          const isEnabled = account?.enabled === true;
          return (
            <div
              key={provider.value}
              className={cn(
                'relative flex items-start space-x-3 rounded-lg border p-4 transition-all',
                value === provider.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RadioGroupItem
                value={provider.value}
                id={provider.value}
                className="mt-1"
                disabled={disabled}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={provider.value}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium cursor-pointer',
                      disabled && 'cursor-not-allowed'
                    )}
                  >
                    {provider.label}
                    {provider.isNew && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                        新
                      </span>
                    )}
                  </Label>
                  {isEnabled ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <BadgeCheck className="h-3 w-3" />
                      已启用
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">未启用</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider.description}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}