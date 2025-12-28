/**
 * API Key 输入组件
 * 支持密码显示/隐藏、多 Key 管理
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onOpenKeyList?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ApiKeyInput({
  value,
  onChange,
  onOpenKeyList,
  disabled = false,
  placeholder = '输入您的 API Key',
}: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="api-key">API Key</Label>
        {onOpenKeyList && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onOpenKeyList}
                  disabled={disabled}
                >
                  <Settings2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>管理多个 API Key</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          id="api-key"
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsVisible(!isVisible)}
          disabled={disabled}
        >
          {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        支持多个 Key（用逗号分隔）
      </p>
    </div>
  );
}
