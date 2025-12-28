/**
 * 添加自定义 Provider 弹窗
 * 支持选择 Provider 类型、上传 Logo、配置默认参数
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Upload, X } from 'lucide-react';
import { AI_PROTOCOL, type AIProtocol } from '@shared/types/ai-provider';
import type { AIProviderId } from '@shared/types';

interface AddProviderPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddProviderData) => void | Promise<void>;
}

export interface AddProviderData {
  name: string;
  type: AIProtocol;
  logo?: string; // Base64 encoded image
  logoFile?: File;
}

export function AddProviderPopup({
  open,
  onOpenChange,
  onConfirm,
}: AddProviderPopupProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }

    // 验证文件大小（最大 2MB）
    if (file.size > 2 * 1024 * 1024) {
      setError('图片大小不能超过 2MB');
      return;
    }

    setError(null);
    setLogoFile(file);

    // 生成预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
  };

  const handleSubmit = async () => {
    // 验证
    if (!name.trim()) {
      setError('请输入 Provider 名称');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        name: name.trim(),
        type,
        logo: logoPreview || undefined,
        logoFile: logoFile || undefined,
      });

      // 重置表单
      setName('');
      setType(AI_PROTOCOL.OPENAI_COMPATIBLE);
      setLogoPreview(null);
      setLogoFile(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setType(AI_PROTOCOL.OPENAI_COMPATIBLE);
    setLogoPreview(null);
    setLogoFile(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加自定义 Provider</DialogTitle>
          <DialogDescription>
            创建一个自定义的 AI Provider 配置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider 名称 */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider 名称</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：My Custom Provider"
              disabled={isSubmitting}
            />
          </div>

          {/* Provider 类型 */}
          <div className="space-y-2">
            <Label>API 类型</Label>
            <RadioGroup
              value={type}
              onValueChange={(val) => setType(val as AIProtocol)}
              disabled={isSubmitting}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value={AI_PROTOCOL.OPENAI_COMPATIBLE}
                  id="add-type-openai"
                />
                <Label
                  htmlFor="add-type-openai"
                  className="font-normal cursor-pointer"
                >
                  OpenAI 兼容格式
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value={AI_PROTOCOL.ANTHROPIC}
                  id="add-type-anthropic"
                />
                <Label
                  htmlFor="add-type-anthropic"
                  className="font-normal cursor-pointer"
                >
                  Anthropic 格式
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Logo 上传 */}
          <div className="space-y-2">
            <Label>Provider Logo（可选）</Label>
            {logoPreview ? (
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-lg border overflow-hidden">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={isSubmitting}
                >
                  <X size={16} className="mr-2" />
                  移除
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isSubmitting}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={isSubmitting}
                >
                  <Upload size={16} className="mr-2" />
                  上传 Logo
                </Button>
                <span className="text-xs text-muted-foreground">
                  支持 PNG、JPG，最大 2MB
                </span>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                添加中...
              </>
            ) : (
              '添加'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
