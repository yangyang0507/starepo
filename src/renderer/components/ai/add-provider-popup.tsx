/**
 * 添加自定义 Provider 弹窗
 * 支持上传自定义图标
 */

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";
import { AI_PROTOCOL, type AIProtocol } from "@shared/types/ai-provider";
import { ProviderIcon } from "./provider-icon";

interface AddProviderPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddProviderData) => void | Promise<void>;
}

export interface AddProviderData {
  name: string;
  type: AIProtocol;
  iconPath?: string; // 可选的图标路径
  iconFile?: File; // 用户上传的图标文件
}

export function AddProviderPopup({
  open,
  onOpenChange,
  onConfirm,
}: AddProviderPopupProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件（PNG、SVG、JPG 等）");
      return;
    }

    // 验证文件大小（限制 2MB）
    if (file.size > 2 * 1024 * 1024) {
      setError("图片大小不能超过 2MB");
      return;
    }

    setIconFile(file);
    setError(null);

    // 生成预览
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // 验证
    if (!name.trim()) {
      setError("请输入 Provider 名称");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        name: name.trim(),
        type,
        iconFile: iconFile || undefined,
      });

      // 重置表单
      setName("");
      setType(AI_PROTOCOL.OPENAI_COMPATIBLE);
      setIconFile(null);
      setIconPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setType(AI_PROTOCOL.OPENAI_COMPATIBLE);
    setIconFile(null);
    setIconPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
            <Select
              value={type}
              onValueChange={(val) => setType(val as AIProtocol)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 API 类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AI_PROTOCOL.OPENAI_COMPATIBLE}>
                  OpenAI
                </SelectItem>
                <SelectItem value={AI_PROTOCOL.ANTHROPIC}>
                  Anthropic
                </SelectItem>
                <SelectItem value={AI_PROTOCOL.GEMINI}>
                  Gemini
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 图标上传 */}
          <div className="space-y-2">
            <Label>Provider 图标（可选）</Label>
            <p className="text-xs text-muted-foreground">
              不上传图标将显示文字缩写
            </p>

            {/* 图标预览或上传按钮 */}
            {iconPreview ? (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                <div className="flex-shrink-0">
                  <img
                    src={iconPreview}
                    alt="图标预览"
                    className="w-12 h-12 rounded object-contain bg-background"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {iconFile?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {iconFile?.size
                      ? `${(iconFile.size / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveIcon}
                  disabled={isSubmitting}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isSubmitting}
                  className="hidden"
                  id="icon-upload"
                />
                <label htmlFor="icon-upload">
                  <div className="flex items-center justify-center gap-2 p-6 rounded-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      点击上传图标
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* 文字预览 */}
            {!iconPreview && name && (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  默认显示：
                </span>
                <ProviderIcon provider={name} size={32} />
                <span className="text-xs text-muted-foreground">
                  （基于名称生成）
                </span>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && <div className="text-sm text-destructive">{error}</div>}
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
              "添加"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
