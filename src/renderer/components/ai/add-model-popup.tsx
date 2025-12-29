/**
 * 添加自定义模型弹窗
 * 支持手动添加自定义模型 ID、显示名称、描述等
 */

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { AIModel } from '@shared/types';

interface AddModelPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (model: AIModel) => void | Promise<void>;
}

export function AddModelPopup({
  open,
  onOpenChange,
  onConfirm,
}: AddModelPopupProps) {
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [supportsVision, setSupportsVision] = useState(false);
  const [supportsTools, setSupportsTools] = useState(false);
  const [maxTokens, setMaxTokens] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // 验证
    if (!modelId.trim()) {
      setError('请输入模型 ID');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newModel: AIModel = {
        id: modelId.trim(),
        displayName: displayName.trim() || modelId.trim(),
        providerId: 'custom', // 会在 provider-setting 中覆盖
        description: description.trim() || undefined,
        capabilities: {
          supportsStreaming: true,
          supportsVision,
          supportsTools,
          maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
        },
        tags: ['custom'],
      };

      await onConfirm(newModel);

      // 重置表单
      setModelId('');
      setDisplayName('');
      setDescription('');
      setSupportsVision(false);
      setSupportsTools(false);
      setMaxTokens('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setModelId('');
    setDisplayName('');
    setDescription('');
    setSupportsVision(false);
    setSupportsTools(false);
    setMaxTokens('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加自定义模型</DialogTitle>
          <DialogDescription>
            手动添加一个自定义模型到列表中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 模型 ID */}
          <div className="space-y-2">
            <Label htmlFor="model-id">
              模型 ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="model-id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="例如：gpt-4-turbo-preview"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              模型的唯一标识符，用于 API 调用
            </p>
          </div>

          {/* 显示名称 */}
          <div className="space-y-2">
            <Label htmlFor="display-name">显示名称</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如：GPT-4 Turbo（可选）"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              在界面上显示的名称，留空则使用模型 ID
            </p>
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述此模型的特点..."
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          {/* 能力选项 */}
          <div className="space-y-3">
            <Label>模型能力</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="supports-vision" className="font-normal cursor-pointer">
                  支持视觉（Vision）
                </Label>
                <Switch
                  id="supports-vision"
                  checked={supportsVision}
                  onCheckedChange={setSupportsVision}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="supports-tools" className="font-normal cursor-pointer">
                  支持工具调用（Tools）
                </Label>
                <Switch
                  id="supports-tools"
                  checked={supportsTools}
                  onCheckedChange={setSupportsTools}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* 最大 Token 数 */}
          <div className="space-y-2">
            <Label htmlFor="max-tokens">最大 Token 数</Label>
            <Input
              id="max-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="例如：128000（可选）"
              disabled={isSubmitting}
            />
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
            disabled={isSubmitting || !modelId.trim()}
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
