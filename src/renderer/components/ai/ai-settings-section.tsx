/**
 * AI 设置区域组件
 * 优化多 Provider 切换体验，支持自动加载已保存的凭据和模型
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from "@/components/ui/separator";
import { Switch } from '@/components/ui/switch';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelSelector } from './model-selector';
import {
  getProviderList,
  getModelList,
  testProviderConnection,
} from '@/api/ai';
import { useAIApi } from '@/api/ai';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import type {
  AIProviderId,
  ProviderOption,
  AIModel,
  ModelSelectionState,
  AISafeSettings,
  ProviderAccountConfig,
  AIProtocol,
} from '@shared/types';
import { AI_PROTOCOL } from '@shared/types/ai-provider';
import { AI_PROVIDER_SYSTEM_CONFIG, getProviderDefinition } from '@shared/data/ai-providers';
import { useLocation } from '@tanstack/react-router';

const AI_SETTINGS_HASH = 'ai-settings';

export function AISettingsSection() {
  const {
    getAISettings: fetchAISettings,
    updateAISettings: persistAISettings,
  } = useAIApi();

  const { initAccounts, getAccount, saveAccount, disableOtherProviders } = useAIAccountsStore();

  // 基础状态
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [provider, setProvider] = useState<AIProviderId>('openai');
  const [model, setModel] = useState<string>('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelState, setModelState] = useState<ModelSelectionState>('idle');
  const [modelError, setModelError] = useState<string>('');
  const [enabled, setEnabled] = useState(false);

  // API Key 相关
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [apiProtocol, setApiProtocol] = useState<AIProtocol>(AI_PROTOCOL.OPENAI_COMPATIBLE);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isUsingSavedAccount, setIsUsingSavedAccount] = useState(false);

  // 参数配置
  const [maxTokens, setMaxTokens] = useState<string>('4096');
  const [temperature, setTemperature] = useState<string>('0.7');
  const [topP, setTopP] = useState<string>('1');

  // UI 状态
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { hash } = useLocation();

  // 获取已配置的 Provider 集合
  const configuredProviders = useAIAccountsStore((state) => state.accounts);

  // 辅助函数：获取 Provider 的默认协议
  const getDefaultProtocol = useCallback((providerId: AIProviderId): AIProtocol => {
    const providerDef = AI_PROVIDER_SYSTEM_CONFIG.providers.find(p => p.id === providerId);
    return providerDef?.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE;
  }, []);

  // 辅助函数：获取默认 API 地址
  const getDefaultBaseUrl = useCallback((providerId: AIProviderId, protocol?: AIProtocol): string => {
    const providerDef = AI_PROVIDER_SYSTEM_CONFIG.providers.find(p => p.id === providerId);
    if (providerDef?.defaults.baseUrl) {
      return providerDef.defaults.baseUrl;
    }
    // 根据协议返回通用默认值
    const effectiveProtocol = protocol || getDefaultProtocol(providerId);
    return effectiveProtocol === AI_PROTOCOL.ANTHROPIC
      ? 'https://api.anthropic.com'
      : 'https://api.openai.com/v1';
  }, [getDefaultProtocol]);

  // 加载 Provider 列表和账户信息
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [providerList] = await Promise.all([
          getProviderList(),
          initAccounts(),
        ]);
        setProviders(providerList);
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    };
    void loadInitialData();
  }, [initAccounts]);

  // 加载指定 Provider 的账户配置
  const loadProviderAccount = useCallback(async (providerId: AIProviderId) => {
    const account = await getAccount(providerId);
    if (account) {
      setApiKey(account.apiKey || '');
      setBaseUrl(account.baseUrl || '');
      setApiProtocol(account.protocol || getDefaultProtocol(providerId));
      setEnabled(account.enabled ?? false);
      setHasStoredKey(true);
      setIsUsingSavedAccount(true);
      return account;
    }
    setApiKey('');
    setBaseUrl('');
    setApiProtocol(getDefaultProtocol(providerId));
    setEnabled(false);
    setHasStoredKey(false);
    setIsUsingSavedAccount(false);
    return null;
  }, [getAccount, getDefaultProtocol]);

  // 加载模型列表
  const loadModels = useCallback(async (config: ProviderAccountConfig, forceRefresh = false) => {
    setModelState('loading');
    setModelError('');

    try {
      const response = await getModelList(config, forceRefresh);
      setModels(response.models);
      setModelState(response.ttl > 0 ? 'success' : 'cached');

      // 如果当前没有选中模型，自动选择第一个
      if (!model && response.models.length > 0) {
        const recommendedModel = response.models.find((m) =>
          m.capabilities?.maxTokens && m.capabilities.maxTokens > 0
        )?.id || response.models[0].id;
        setModel(recommendedModel);
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : '加载模型列表失败');
      setModelState('error');
      setModels([]);
    }
  }, [model]);

  // 当 Provider 变化时，自动加载已保存的凭据并获取模型列表
  useEffect(() => {
    const handleProviderChange = async () => {
      setTestFeedback(null);
      setSaveFeedback(null);

      // 尝试加载已保存的账户配置
      const account = await loadProviderAccount(provider);

      // 如果有已保存的配置，自动加载模型
      if (account?.apiKey) {
        const config: ProviderAccountConfig = {
          providerId: provider,
          protocol: account.protocol || getDefaultProtocol(provider),
          apiKey: account.apiKey,
          baseUrl: account.baseUrl || undefined,
          timeout: 30000,
          retries: 3,
          strictTLS: true,
          enabled: true,
        };
        await loadModels(config);
      } else {
        // 没有已保存的配置，使用 Provider 的默认模型列表
        const providerDef = getProviderDefinition(provider);
        if (providerDef?.defaults?.models && providerDef.defaults.models.length > 0) {
          const defaultModels: AIModel[] = providerDef.defaults.models.map((modelId) => ({
            id: modelId,
            displayName: modelId,
            capabilities: { maxTokens: providerDef.defaults.maxTokens },
          }));
          setModels(defaultModels);
          setModel(providerDef.defaults.recommendedModel || defaultModels[0]?.id || '');
          setModelState('success');
        } else {
          // 完全没有默认模型，清空
          setModels([]);
          setModelState('idle');
          setModel('');
        }
      }
    };

    void handleProviderChange();
  }, [provider, loadProviderAccount, loadModels]);

  // 水合设置
  const hydrateSettings = useCallback((settings: AISafeSettings | null) => {
    const nextProvider = (settings?.provider as AIProviderId) ?? 'openai';
    setProvider(nextProvider);
    setModel(settings?.model || '');
    setEnabled(settings?.enabled ?? false);
    setMaxTokens(String(settings?.maxTokens ?? 4096));
    setTemperature(String(settings?.temperature ?? 0.7));
    setTopP(String(settings?.topP ?? 1));
    setApiKeyVisible(false);
  }, []);

  // 加载设置
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingSettings(true);
      try {
        const settings = await fetchAISettings();
        if (cancelled) return;
        hydrateSettings(settings);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '加载 AI 设置失败';
          setSaveFeedback({ type: 'error', message });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchAISettings, hydrateSettings]);

  // 处理 hash 导航
  useEffect(() => {
    if (!sectionRef.current) return;
    if (hash === `#${AI_SETTINGS_HASH}`) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return undefined;
  }, [hash]);

  // 测试连接
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const effectiveApiKey = apiKey.trim();
      if (!effectiveApiKey) {
        throw new Error('请先输入 API Key 后再进行连接测试');
      }

      const config: ProviderAccountConfig = {
        providerId: provider,
        protocol: apiProtocol,
        apiKey: effectiveApiKey,
        baseUrl: baseUrl.trim() || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const result = await testProviderConnection(config);

      if (result.success) {
        setTestFeedback({
          type: 'success',
          message: `连接成功！${result.details?.modelCount ? `找到 ${result.details.modelCount} 个模型` : ''}`,
        });
        // 测试成功后自动加载模型
        await loadModels(config, true);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      setTestFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '连接测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (newEnabled: boolean) => {
    const trimmedKey = apiKey.trim();
    const trimmedUrl = baseUrl.trim();

    if (!trimmedKey) {
      return;
    }

    setEnabled(newEnabled);

    // 保存当前 Provider 的启用状态
    if (isUsingSavedAccount) {
      const existingAccount = await getAccount(provider);
      if (existingAccount) {
        await saveAccount({
          ...existingAccount,
          enabled: newEnabled,
        });
      }
    } else {
      // 新配置的账户
      const accountConfig: ProviderAccountConfig = {
        providerId: provider,
        protocol: apiProtocol,
        apiKey: trimmedKey,
        baseUrl: trimmedUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: newEnabled,
      };
      await saveAccount(accountConfig);
      setIsUsingSavedAccount(true);
      setHasStoredKey(true);
    }

    // 如果启用当前 Provider，禁用其他所有 Provider
    if (newEnabled) {
      await disableOtherProviders(provider);
    }
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const trimmedKey = apiKey.trim();
      const trimmedUrl = baseUrl.trim();

      // 如果是新输入的凭据，保存到 Provider 账户存储（保留当前启用状态）
      if (trimmedKey && !isUsingSavedAccount) {
        const accountConfig: ProviderAccountConfig = {
          providerId: provider,
          protocol: apiProtocol,
          apiKey: trimmedKey,
          baseUrl: trimmedUrl || undefined,
          timeout: 30000,
          retries: 3,
          strictTLS: true,
          enabled,
        };
        await saveAccount(accountConfig);
        setIsUsingSavedAccount(true);
        setHasStoredKey(true);
      } else if (trimmedKey && isUsingSavedAccount) {
        // 更新已保存的账户（保留当前启用状态）
        const existingAccount = await getAccount(provider);
        if (existingAccount) {
          const updatedConfig: ProviderAccountConfig = {
            ...existingAccount,
            protocol: apiProtocol,
            apiKey: trimmedKey,
            baseUrl: trimmedUrl || undefined,
          };
          await saveAccount(updatedConfig);
        }
      }

      if (!trimmedKey && !hasStoredKey) {
        throw new Error('首次配置需要输入有效的 API Key');
      }

      if (!model) {
        throw new Error('请选择 LLM 模型');
      }

      const maxTokensValue = Number(maxTokens);
      if (Number.isNaN(maxTokensValue) || maxTokensValue <= 0) {
        throw new Error('Max Tokens 必须是正整数');
      }

      const temperatureValue = Number(temperature);
      if (Number.isNaN(temperatureValue) || temperatureValue < 0 || temperatureValue > 2) {
        throw new Error('Temperature 必须在 0-2 之间');
      }

      const topPValue = Number(topP);
      if (Number.isNaN(topPValue) || topPValue < 0 || topPValue > 1) {
        throw new Error('Top P 必须在 0-1 之间');
      }

      const payload = {
        provider,
        model,
        enabled,
        maxTokens: maxTokensValue,
        temperature: temperatureValue,
        topP: topPValue,
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
        ...(trimmedUrl ? { baseURL: trimmedUrl } : {}),
      };

      await persistAISettings(payload);
      const refreshed = await fetchAISettings();
      hydrateSettings(refreshed);
      setSaveFeedback({ type: 'success', message: 'AI 设置已保存' });
      setHasStoredKey(Boolean(trimmedKey) || isUsingSavedAccount);
      setIsUsingSavedAccount(Boolean(trimmedKey) || isUsingSavedAccount);
    } catch (error) {
      setSaveFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '保存设置失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在加载 AI 设置...
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Column: Provider List */}
      <aside className="w-60 border-r bg-muted/10 flex flex-col">
        <div className="overflow-y-auto p-4 flex-1 min-h-0">
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold">AI 提供商</h3>
              <p className="text-xs text-muted-foreground mb-3">
                选择要配置的模型服务商
              </p>
            </div>
            <div className="space-y-0.5">
              {providers.map((p) => {
                const isActive = provider === p.value;
                const account = configuredProviders.get(p.value);
                const isEnabled = account?.enabled === true;
                return (
                  <button
                    key={p.value}
                    onClick={() => !isSaving && !isTesting && setProvider(p.value)}
                    disabled={isSaving || isTesting}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      (isSaving || isTesting) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {p.label}
                      {p.isNew && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full",
                          isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                        )}>
                          NEW
                        </span>
                      )}
                    </span>
                    {isEnabled && (
                      <CheckCircle className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-green-500")} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* Right Column: Configuration Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{providers.find(p => p.value === provider)?.label}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                配置 API Key 和模型参数
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Label htmlFor="ai-enabled" className="text-sm cursor-pointer">
                启用
              </Label>
              <Switch
                id="ai-enabled"
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={!apiKey.trim()}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* API Key 和 Base URL */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ai-api-key" className="text-sm font-medium">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="ai-api-key"
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    hasStoredKey
                      ? '已保存的 API Key，输入新值可替换'
                      : '输入您的 API Key'
                  }
                  className="font-mono text-sm"
                  disabled={isSaving || isTesting}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setApiKeyVisible((visible) => !visible)}
                  disabled={isSaving || isTesting}
                >
                  {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">API 类型</Label>
              <RadioGroup
                value={apiProtocol}
                onValueChange={(value) => setApiProtocol(value as AIProtocol)}
                disabled={isSaving || isTesting}
              >
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={AI_PROTOCOL.OPENAI_COMPATIBLE} id="protocol-openai" />
                    <Label htmlFor="protocol-openai" className="font-normal cursor-pointer">
                      OpenAI 兼容格式
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={AI_PROTOCOL.ANTHROPIC} id="protocol-anthropic" />
                    <Label htmlFor="protocol-anthropic" className="font-normal cursor-pointer">
                      Anthropic 格式
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                选择您的 API 端点使用的协议格式
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-base-url" className="text-sm font-medium">API 地址</Label>
              <Input
                id="ai-base-url"
                type="text"
                value={baseUrl || getDefaultBaseUrl(provider, apiProtocol)}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="font-mono text-sm"
                disabled={isSaving || isTesting}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* 模型选择器 */}
          <ModelSelector
            models={models}
            value={model}
            onChange={setModel}
            onRefresh={() => {
              const effectiveApiKey = apiKey.trim();
              if (effectiveApiKey) {
                const config: ProviderAccountConfig = {
                  providerId: provider,
                  protocol: apiProtocol,
                  apiKey: effectiveApiKey,
                  baseUrl: baseUrl.trim() || undefined,
                  timeout: 30000,
                  retries: 3,
                  strictTLS: true,
                  enabled: true,
                };
                void loadModels(config, true);
              }
            }}
            state={modelState}
            error={modelError}
            disabled={isSaving || isTesting}
            allowCustomInput={true}
          />

          {/* 参数配置 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">模型参数</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="max-tokens" className="text-sm">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min={1}
                  max={100000}
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(event.target.value)}
                  disabled={isSaving || isTesting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature" className="text-sm">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step={0.1}
                  min={0}
                  max={2}
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                  disabled={isSaving || isTesting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="top-p" className="text-sm">Top P</Label>
                <Input
                  id="top-p"
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  value={topP}
                  onChange={(event) => setTopP(event.target.value)}
                  disabled={isSaving || isTesting}
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={isTesting || isSaving || !apiKey.trim()}
                variant="outline"
                size="default"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    测试中...
                  </>
                ) : (
                  '测试连接'
                )}
              </Button>

              <Button onClick={handleSave} disabled={isSaving || isTesting} size="default">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存设置'
                )}
              </Button>
            </div>

            {(testFeedback || saveFeedback) && (
              <div className="space-y-2">
                {testFeedback && (
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm px-3 py-2 rounded-md',
                      testFeedback.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    )}
                  >
                    {testFeedback.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{testFeedback.message}</span>
                  </div>
                )}

                {saveFeedback && (
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm px-3 py-2 rounded-md',
                      saveFeedback.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    )}
                  >
                    {saveFeedback.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{saveFeedback.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
