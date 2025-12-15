/**
 * AI 设置区域组件
 * 使用新的 Provider 和模型选择器
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProviderSelector } from './provider-selector';
import { ModelSelector } from './model-selector';
import {
  getProviderList,
  getModelList,
  testProviderConnection,
  clearModelCache,
} from '@/api/ai';
import { useAIApi } from '@/api/ai';
import type {
  AIProviderId,
  ProviderOption,
  AIModel,
  ModelSelectionState,
  AISafeSettings,
  ProviderAccountConfig,
} from '@shared/types';
import { useLocation } from '@tanstack/react-router';

const AI_SETTINGS_HASH = 'ai-settings';

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return null;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
};

export function AISettingsSection() {
  const {
    getAISettings: fetchAISettings,
    updateAISettings: persistAISettings,
  } = useAIApi();

  // 基础状态
  const [safeSettings, setSafeSettings] = useState<AISafeSettings | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [provider, setProvider] = useState<AIProviderId>('openai');
  const [model, setModel] = useState<string>('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelState, setModelState] = useState<ModelSelectionState>('idle');
  const [modelError, setModelError] = useState<string>('');

  // API Key 相关
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

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
  const [highlight, setHighlight] = useState(false);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { hash } = useLocation();

  // 加载 Provider 列表
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const list = await getProviderList();
        setProviders(list);
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    };
    void loadProviders();
  }, []);

  // 加载模型列表
  const loadModels = useCallback(async (forceRefresh = false) => {
    if (!provider || !apiKey.trim()) {
      setModels([]);
      setModelState('idle');
      return;
    }

    setModelState('loading');
    setModelError('');

    try {
      const config: ProviderAccountConfig = {
        providerId: provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const response = await getModelList(config, forceRefresh);
      setModels(response.models);
      setModelState(response.ttl > 0 ? 'success' : 'cached');

      // 如果当前没有选中模型，自动选择第一个
      if (!model && response.models.length > 0) {
        setModel(response.models[0].id);
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : '加载模型列表失败');
      setModelState('error');
      setModels([]);
    }
  }, [provider, apiKey, baseUrl, model]);

  // 当 Provider 或 API Key 变化时，自动加载模型
  useEffect(() => {
    if (provider && apiKey.trim()) {
      void loadModels();
    }
  }, [provider, apiKey, loadModels]);

  // 水合设置
  const hydrateSettings = useCallback((settings: AISafeSettings | null) => {
    setSafeSettings(settings);
    const nextProvider = (settings?.provider as AIProviderId) ?? 'openai';
    setProvider(nextProvider);
    setModel(settings?.model || '');
    setMaxTokens(String(settings?.maxTokens ?? 4096));
    setTemperature(String(settings?.temperature ?? 0.7));
    setTopP(String(settings?.topP ?? 1));
    setHasStoredKey(Boolean(settings?.configured));
    setApiKey('');
    setBaseUrl('');
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
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hash]);

  // 处理 Provider 变更
  const handleProviderChange = (nextProvider: AIProviderId) => {
    setProvider(nextProvider);
    setModel('');
    setModels([]);
    setApiKey('');
    setBaseUrl('');
    setApiKeyVisible(false);
    setHasStoredKey(false);
    setTestFeedback(null);
    setSaveFeedback(null);
    setModelState('idle');
  };

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
          message: `连接成功！${result.modelCount ? `找到 ${result.modelCount} 个模型` : ''}`,
        });
        // 测试成功后自动加载模型
        await loadModels(true);
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

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const trimmedKey = apiKey.trim();
      if (!hasStoredKey && !trimmedKey) {
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
        maxTokens: maxTokensValue,
        temperature: temperatureValue,
        topP: topPValue,
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
        ...(baseUrl.trim() ? { baseURL: baseUrl.trim() } : {}),
      };

      await persistAISettings(payload);
      const refreshed = await fetchAISettings();
      hydrateSettings(refreshed);
      setSaveFeedback({ type: 'success', message: 'AI 设置已保存' });
      setHasStoredKey(Boolean(trimmedKey) || Boolean(refreshed?.configured));
    } catch (error) {
      setSaveFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '保存设置失败',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = safeSettings?.configured ?? false;
  const lastUpdatedLabel = formatTimestamp(safeSettings?.lastUpdated);

  return (
    <Card
      id={AI_SETTINGS_HASH}
      ref={sectionRef}
      className={cn(
        'transition-shadow duration-300',
        highlight ? 'ring-2 ring-primary/60 shadow-lg' : undefined
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            🤖 AI 助手设置
            <Badge variant={isConfigured ? 'default' : 'secondary'}>
              {isConfigured ? '已配置' : '未配置'}
            </Badge>
          </span>
          {lastUpdatedLabel ? (
            <span className="text-xs text-muted-foreground">最后更新：{lastUpdatedLabel}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>在此集中管理所有 AI 相关配置。支持多种 AI Provider 和自动模型发现。</p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
            💡 提示：保存后配置会立即生效，API Key 始终在本地安全存储。
          </div>
        </div>

        {isLoadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 AI 设置...
          </div>
        ) : (
          <>
            <section className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">LLM API 配置</h3>
                <p className="text-sm text-muted-foreground">
                  选择对话模型提供商并配置 API Key、模型与采样参数。
                </p>
              </div>

              {/* Provider 选择器 */}
              <ProviderSelector
                providers={providers}
                value={provider}
                onChange={handleProviderChange}
                disabled={isSaving || isTesting}
              />

              {/* API Key 和 Base URL */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-api-key" className="text-base font-semibold">
                    API Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="ai-api-key"
                      type={apiKeyVisible ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        hasStoredKey
                          ? '已保存的 API Key 已隐藏，输入新值可替换'
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
                  <p className="text-xs text-muted-foreground">
                    我们不会上传或记录您的 API Key，数据仅保存在本地加密存储。
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-base-url" className="text-base font-semibold">
                    Base URL（可选）
                  </Label>
                  <Input
                    id="ai-base-url"
                    type="text"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="自定义 API 端点（留空使用默认）"
                    className="font-mono text-sm"
                    disabled={isSaving || isTesting}
                  />
                  <p className="text-xs text-muted-foreground">
                    用于自定义 API 端点或代理服务。
                  </p>
                </div>
              </div>

              {/* 模型选择器 */}
              <ModelSelector
                models={models}
                value={model}
                onChange={setModel}
                onRefresh={() => loadModels(true)}
                state={modelState}
                error={modelError}
                disabled={isSaving || isTesting}
                allowCustomInput={true}
              />

              {/* 参数配置 */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="max-tokens" className="text-base font-semibold">
                    Max Tokens
                  </Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min={1}
                    max={100000}
                    value={maxTokens}
                    onChange={(event) => setMaxTokens(event.target.value)}
                    disabled={isSaving || isTesting}
                  />
                  <p className="text-xs text-muted-foreground">
                    限制模型单次回复的最大 token 数。
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature" className="text-base font-semibold">
                    Temperature
                  </Label>
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
                  <p className="text-xs text-muted-foreground">
                    控制回答的随机性，0 更稳健，1 更具创造力。
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="top-p" className="text-base font-semibold">
                    Top P
                  </Label>
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
                  <p className="text-xs text-muted-foreground">
                    采样概率阈值，建议保持默认 1。
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving || !apiKey.trim()}
                  variant="outline"
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

                <Button onClick={handleSave} disabled={isSaving || isTesting}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存设置'
                  )}
                </Button>

                {testFeedback && (
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      testFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {testFeedback.type === 'success' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {testFeedback.message}
                  </div>
                )}

                {saveFeedback && (
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      saveFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {saveFeedback.type === 'success' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {saveFeedback.message}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}