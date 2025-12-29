/**
 * 添加自定义 Provider 弹窗
 * 支持从 @lobehub/icons 图标库中选择图标
 */

import React, { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search } from 'lucide-react';
import { AI_PROTOCOL, type AIProtocol } from '@shared/types/ai-provider';
import { providerMappings } from '@lobehub/icons/es/features/providerConfig';

interface AddProviderPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddProviderData) => void | Promise<void>;
}

export interface AddProviderData {
  name: string;
  type: AIProtocol;
  iconId: string; // 选择的图标 ID
}

export function AddProviderPopup({
  open,
  onOpenChange,
  onConfirm,
}: AddProviderPopupProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 构建可选择的图标列表
  const iconOptions: Array<{
    id: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    keywords: string[];
  }> = useMemo(() => {
    return providerMappings.map((mapping) => ({
      id: mapping.keywords[0]?.replace('^', '').replace('/', '') || Math.random().toString(),
      Icon: mapping.Icon,
      keywords: mapping.keywords,
    }));
  }, []);

  // 过滤图标
  const filteredIcons = useMemo(() => {
    if (!searchText.trim()) return iconOptions;

    const lowerSearch = searchText.toLowerCase();
    return iconOptions.filter((option) =>
      option.keywords.some((keyword) =>
        keyword.toLowerCase().replace('^', '').includes(lowerSearch)
      )
    );
  }, [iconOptions, searchText]);

  const handleSubmit = async () => {
    // 验证
    if (!name.trim()) {
      setError('请输入 Provider 名称');
      return;
    }

    if (!selectedIconId) {
      setError('请选择一个图标');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        name: name.trim(),
        type,
        iconId: selectedIconId,
      });

      // 重置表单
      setName('');
      setType(AI_PROTOCOL.OPENAI_COMPATIBLE);
      setSelectedIconId(null);
      setSearchText('');
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
    setSelectedIconId(null);
    setSearchText('');
    setError(null);
    onOpenChange(false);
  };

  // 获取选中的图标组件
  const SelectedIcon = useMemo(() => {
    if (!selectedIconId) return null;
    return iconOptions.find((opt) => opt.id === selectedIconId)?.Icon;
  }, [selectedIconId, iconOptions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
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

          {/* 图标选择 */}
          <div className="space-y-2">
            <Label>选择图标</Label>

            {/* 搜索框 */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索图标（例如：openai、anthropic）..."
                className="pl-9"
                disabled={isSubmitting}
              />
            </div>

            {/* 当前选中的图标 */}
            {SelectedIcon && (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <span className="text-sm text-muted-foreground">已选择：</span>
                <div className="w-6 h-6">
                  <SelectedIcon size={24} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIconId(null)}
                  disabled={isSubmitting}
                  className="h-6 px-2 text-xs"
                >
                  清除
                </Button>
              </div>
            )}

            {/* 图标网格 */}
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-3 grid grid-cols-8 gap-2">
                {filteredIcons.map((option) => {
                  const isSelected = selectedIconId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedIconId(option.id)}
                      disabled={isSubmitting}
                      className={`
                        flex items-center justify-center p-2 rounded-md transition-all
                        ${isSelected
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                          : 'hover:bg-muted'
                        }
                      `}
                      title={option.keywords.join(', ')}
                    >
                      <option.Icon size={24} />
                    </button>
                  );
                })}
                {filteredIcons.length === 0 && (
                  <div className="col-span-8 text-center text-sm text-muted-foreground py-8">
                    未找到匹配的图标
                  </div>
                )}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              共 {filteredIcons.length} 个图标可选
            </p>
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
            disabled={isSubmitting || !name.trim() || !selectedIconId}
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
