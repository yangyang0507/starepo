/**
 * Provider 设置组件
 * 右侧面板，显示选中 Provider 的详细配置
 */

import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { ApiKeyInput } from './api-key-input';
import { BaseUrlInput } from './base-url-input';
import { ProtocolSelector } from './protocol-selector';
import { ConnectionTestButton } from './connection-test-button';
import { ModelSelector } from './model-selector';
import { getModelList, testProviderConnection } from '@/api/ai';
import { AI_PROTOCOL, type AIProviderId, type AIProtocol, type AIModel, type ModelSelectionState } from '@shared/types';

interface ProviderSettingProps {
  providerId: AIProviderId;
  providerName?: string;
}

export function ProviderSetting({ providerId, providerName }: ProviderSettingProps) {
  const { accounts, getAccount, saveAccount } = useAIAccountsStore();
  const account = accounts.get(providerId);

  // 表单状态
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [protocol, setProtocol] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [defaultModel, setDefaultModel] = useState('');
  const [enabled, setEnabled] = useState(false);

  // UI 状态
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // 模型列表状态
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelState, setModelState] = useState<ModelSelectionState>('idle');
  const [modelError, setModelError] = useState('');

  const displayName = providerName || account?.name || providerId;

  // 初始化表单数据
  useEffect(() => {
    if (account) {
      setApiKey(account.apiKey || '');
      setBaseUrl(account.baseUrl || '');
      setProtocol(account.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE);
      setDefaultModel(account.defaultModel || '');
      setEnabled(account.enabled ?? false);
    } else {
      // 重置表单
      setApiKey('');
      setBaseUrl('');
      setProtocol(AI_PROTOCOL.OPENAI_COMPATIBLE);
      setDefaultModel('');
      setEnabled(false);
    }
  }, [account]);

  // 加载模型列表
  const loadModels = async (forceRefresh = false) => {
    if (!apiKey) {
      setModelError('请先输入 API Key');
      setModelState('error');
      return;
    }

    try {
      setModelState('loading');
      setModelError('');

      const config = {
        providerId,
        protocol,
        apiKey,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const result = await getModelList(config, forceRefresh);
      setModels(result.models);
      setModelState(forceRefresh ? 'success' : 'cached');
    } catch (error) {
      console.error('Failed to load models:', error);
      setModelError(error instanceof Error ? error.message : '加载失败');
      setModelState('error');
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestError('请先输入 API Key');
      setTestStatus('error');
      return;
    }

    try {
      setIsTesting(true);
      setTestStatus('idle');
      setTestError('');

      const config = {
        providerId,
        protocol,
        apiKey,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const result = await testProviderConnection(config);

      if (result.success) {
        setTestStatus('success');
        // 连接成功后自动加载模型列表
        await loadModels(true);
      } else {
        setTestStatus('error');
        setTestError(result.error || '连接失败');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveFeedback(null);

      await saveAccount({
        providerId,
        protocol,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        defaultModel: defaultModel || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled,
      });

      // 显示成功提示
      setSaveFeedback({ type: 'success', message: '配置已保存' });
      // 3 秒后自动清除提示
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    try {
      const existingConfig = await getAccount(providerId);
      await saveAccount({
        ...(existingConfig || {
          providerId,
          timeout: 30000,
          retries: 3,
          strictTLS: true,
        }),
        enabled: newEnabled,
      });
    } catch (error) {
      console.error('Failed to toggle provider:', error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* 标题和启用开关 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              配置 API Key 和模型参数
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Label htmlFor="provider-enabled" className="text-sm cursor-pointer">
              启用
            </Label>
            <Switch
              id="provider-enabled"
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
        </div>

        <Separator />

        {/* 配置表单 */}
        <div className="space-y-6">
          {/* API Key */}
          <ApiKeyInput
            value={apiKey}
            onChange={setApiKey}
          />

          {/* Base URL */}
          <BaseUrlInput
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="可选，留空使用默认地址"
          />

          {/* 协议选择 */}
          <ProtocolSelector
            value={protocol}
            onChange={setProtocol}
          />

          {/* 连接测试 */}
          <ConnectionTestButton
            onTest={handleTestConnection}
            isLoading={isTesting}
            status={testStatus}
            errorMessage={testError}
            disabled={!apiKey}
          />

          {/* 模型选择 */}
          {testStatus === 'success' && (
            <ModelSelector
              models={models}
              value={defaultModel}
              onChange={setDefaultModel}
              onRefresh={() => loadModels(true)}
              state={modelState}
              error={modelError}
            />
          )}

          {/* 保存按钮和反馈 */}
          <div className="space-y-3 pt-4">
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={isSaving || !apiKey}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    保存配置
                  </>
                )}
              </Button>
            </div>

            {/* 保存反馈提示 */}
            {saveFeedback && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                  saveFeedback.type === 'success'
                    ? 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {saveFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="flex-shrink-0" />
                )}
                <span>{saveFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
