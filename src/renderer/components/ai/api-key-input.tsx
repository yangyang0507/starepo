/**
 * API Key 输入组件
 * 支持密码显示/隐藏
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ApiKeyInput({
  value,
  onChange,
  disabled = false,
  placeholder = '输入您的 API Key',
}: ApiKeyInputProps) {
  const [isVisible, setIsVisible] = useState(false);

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
      </div>
    </div>
  );
}
