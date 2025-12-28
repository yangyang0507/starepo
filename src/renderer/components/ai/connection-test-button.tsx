/**
 * 连接测试按钮组件
 * 测试 Provider 连接状态
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionTestButtonProps {
  onTest: () => void | Promise<void>;
  isLoading?: boolean;
  status?: 'idle' | 'success' | 'error';
  disabled?: boolean;
  errorMessage?: string;
}

export function ConnectionTestButton({
  onTest,
  isLoading = false,
  status = 'idle',
  disabled = false,
  errorMessage,
}: ConnectionTestButtonProps) {
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={isSuccess ? 'default' : 'outline'}
        onClick={onTest}
        disabled={disabled || isLoading}
        className={cn(isSuccess && 'bg-green-600 hover:bg-green-700')}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            测试中...
          </>
        ) : isSuccess ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            连接成功
          </>
        ) : (
          '测试连接'
        )}
      </Button>

      {isError && errorMessage && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
