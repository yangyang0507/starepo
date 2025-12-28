/**
 * API Key 输入组件
 * 支持密码显示/隐藏、连接检测
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  // 连接测试相关
  onTest?: () => void | Promise<void>;
  isTestLoading?: boolean;
  testStatus?: 'idle' | 'success' | 'error';
}

export function ApiKeyInput({
  value,
  onChange,
  disabled = false,
  placeholder = '输入您的 API Key',
  onTest,
  isTestLoading = false,
  testStatus = 'idle',
}: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isSuccess = testStatus === 'success';

  return (
    <div className="space-y-2">
      <Label htmlFor="api-key">API Key</Label>

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
        {onTest && (
          <Button
            type="button"
            variant={isSuccess ? 'default' : 'outline'}
            onClick={onTest}
            disabled={disabled || isTestLoading || !value}
            className={cn(isSuccess && 'bg-green-600 hover:bg-green-700')}
          >
            {isTestLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                检测中
              </>
            ) : isSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                成功
              </>
            ) : (
              '检测'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
