/**
 * Provider 设置组件
 * 右侧面板，显示选中 Provider 的详细配置
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { ApiKeyInput } from './api-key-input';
import { BaseUrlInput } from './base-url-input';
import { ProtocolSelector } from './protocol-selector';
import { ModelList } from './model-list';
import { getModelList, testProviderConnection } from '@/api/ai';
import { getProviderDefinition } from '@shared/data/ai-providers';
import { AI_PROTOCOL, type AIProviderId, type AIProtocol, type AIModel, type ModelSelectionState } from '@shared/types';

interface ProviderSettingProps {
  providerId: AIProviderId;
  providerName?: string;
}

export function ProviderSetting({ providerId, providerName }: ProviderSettingProps) {
  const { accounts, getAccount, saveAccount } = useAIAccountsStore();
  const accountMetadata = accounts.get(providerId);
  const providerDefinition = getProviderDefinition(providerId);

  // 表单状态
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [protocol, setProtocol] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [enabled, setEnabled] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

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

  const displayName = providerName || accountMetadata?.name || providerId;
  const defaultBaseUrl = providerDefinition?.defaults.baseUrl || '';

  // 初始化表单数据 - 从后端加载完整配置
  useEffect(() => {
    const loadAccount = async () => {
      setIsLoadingAccount(true);
      // 重置模型状态
      setModels([]);
      setModelState('idle');
      setModelError('');

      try {
        const account = await getAccount(providerId);
        if (account) {
          setApiKey(account.apiKey || '');
          setBaseUrl(account.baseUrl || defaultBaseUrl);
          setProtocol(account.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE);
          setEnabled(account.enabled ?? false);

          // 如果有 API Key，尝试加载缓存的模型列表（不发起网络请求）
          if (account.apiKey) {
            try {
              const config = {
                providerId,
                protocol: account.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE,
                apiKey: account.apiKey,
                baseUrl: account.baseUrl || defaultBaseUrl || undefined,
                timeout: 30000,
                retries: 3,
                strictTLS: true,
                enabled: true,
              };

              // 不强制刷新，优先使用缓存
              const result = await getModelList(config, false);

              // 只有当返回的模型数量 > 0 时才设置（说明有缓存）
              if (result.models.length > 0) {
                setModels(result.models);
                setModelState('idle');
              }
            } catch (error) {
              // 静默失败，不显示错误
              console.debug('No cached models available:', error);
            }
          }
        } else {
          // 重置表单，使用默认值
          setApiKey('');
          setBaseUrl(defaultBaseUrl);
          setProtocol(AI_PROTOCOL.OPENAI_COMPATIBLE);
          setEnabled(false);
        }
      } catch (error) {
        console.error('Failed to load account:', error);
      } finally {
        setIsLoadingAccount(false);
      }
    };

    void loadAccount();
  }, [providerId, getAccount, defaultBaseUrl]);

  // 加载模型列表
  const loadModels = async (forceRefresh = false) => {
    if (!apiKey) {
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
        setTestError(typeof result.error === 'string' ? result.error : result.error?.message || '连接失败');
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
              disabled={isLoadingAccount}
            />
          </div>
        </div>

        <Separator />

        {/* 加载状态 */}
        {isLoadingAccount ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载配置中...</span>
          </div>
        ) : (
          /* 配置表单 */
          <div className="space-y-6">
          {/* API Key */}
          <ApiKeyInput
            value={apiKey}
            onChange={setApiKey}
            onTest={handleTestConnection}
            isTestLoading={isTesting}
            testStatus={testStatus}
          />

          {/* 测试错误提示 */}
          {testStatus === 'error' && testError && (
            <div className="flex items-start gap-2 text-sm text-destructive -mt-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{testError}</span>
            </div>
          )}

          {/* Base URL */}
          <BaseUrlInput
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="API 服务地址"
          />

          {/* 协议选择 */}
          <ProtocolSelector
            value={protocol}
            onChange={setProtocol}
          />

          {/* 模型列表（始终显示） */}
          <ModelList
            models={models}
            state={modelState}
            onRefresh={() => loadModels(true)}
            onAddCustomModel={() => {
              // TODO: 实现添加自定义模型功能
              console.log('添加自定义模型');
            }}
            error={modelError}
          />

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
        )}
      </div>
    </div>
  );
}
