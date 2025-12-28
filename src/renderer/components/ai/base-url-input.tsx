/**
 * Base URL 输入组件
 * 支持 URL 验证和重置功能
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface BaseUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onReset?: () => void;
  disabled?: boolean;
  placeholder?: string;
  showReset?: boolean;
  preview?: string;
}

export function BaseUrlInput({
  value,
  onChange,
  onBlur,
  onReset,
  disabled = false,
  placeholder = '输入 API 地址',
  showReset = false,
  preview,
}: BaseUrlInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="base-url">API 地址</Label>

      <div className="flex gap-2">
        <Input
          id="base-url"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 font-mono text-sm"
        />
        {showReset && onReset && (
          <Button
            type="button"
            variant="destructive"
            onClick={onReset}
            disabled={disabled}
          >
            重置
          </Button>
        )}
      </div>

      {preview && (
        <p className="text-xs text-muted-foreground">
          预览：{preview}
        </p>
      )}
    </div>
  );
}
