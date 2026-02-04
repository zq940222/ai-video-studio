'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Key,
  Brain,
  Image,
  Video,
  Mic,
  Music,
  Trash2,
  Check,
  Loader2,
  ArrowLeft,
  LogIn,
  Link as LinkIcon,
  Server,
} from 'lucide-react';
import Link from 'next/link';

type AuthType = 'api_key' | 'oauth';

interface ProviderConfig {
  name: string;
  type: 'llm' | 'image' | 'video' | 'voice' | 'music';
  description: string;
  placeholder?: string;
  isLocal?: boolean;
  authTypes: AuthType[];
  supportsOAuth?: boolean;
}

// Provider configuration (should match server-side)
const AI_PROVIDERS: Record<string, ProviderConfig> = {
  ollama: { name: 'Ollama', type: 'llm', description: '本地部署，支持 Llama/Qwen/Mistral 等', placeholder: 'http://localhost:11434', isLocal: true, authTypes: ['api_key'] },
  openai: { name: 'OpenAI', type: 'llm', description: 'GPT-4, GPT-3.5 等模型', placeholder: 'sk-...', authTypes: ['api_key'] },
  anthropic: { name: 'Anthropic', type: 'llm', description: 'Claude 系列模型', placeholder: 'sk-ant-...', authTypes: ['api_key'] },
  gemini: { name: 'Google Gemini', type: 'llm', description: 'Gemini Pro, Gemini Ultra 等模型', placeholder: 'AIza...', authTypes: ['api_key', 'oauth'], supportsOAuth: true },
  qwen: { name: '通义千问', type: 'llm', description: '阿里云通义千问', placeholder: 'sk-...', authTypes: ['api_key', 'oauth'], supportsOAuth: true },
  comfyui: { name: 'ComfyUI', type: 'image', description: '本地部署，支持 FLUX/SD', placeholder: 'http://localhost:8188', isLocal: true, authTypes: ['api_key'] },
  nanobanana: { name: 'NanoBanana', type: 'image', description: 'NanoBanana GPU 云平台', placeholder: 'your-api-key', authTypes: ['api_key', 'oauth'], supportsOAuth: true },
  'comfyui-video': { name: 'ComfyUI Video', type: 'video', description: '本地部署，支持 Wan2.1/AnimateDiff', placeholder: 'http://localhost:8188', isLocal: true, authTypes: ['api_key'] },
  kling: { name: '可灵', type: 'video', description: '快手可灵视频生成', placeholder: 'your-api-key', authTypes: ['api_key', 'oauth'], supportsOAuth: true },
  runway: { name: 'Runway', type: 'video', description: 'Runway Gen-2/Gen-3', placeholder: 'your-api-key', authTypes: ['api_key'] },
  jimeng: { name: '即梦', type: 'video', description: '字节跳动即梦', placeholder: 'your-api-key', authTypes: ['api_key', 'oauth'], supportsOAuth: true },
  'comfyui-voice': { name: 'ComfyUI Voice', type: 'voice', description: '本地部署，支持 Qwen3-TTS/MegaTTS3', placeholder: 'http://localhost:8188', isLocal: true, authTypes: ['api_key'] },
  elevenlabs: { name: 'ElevenLabs', type: 'voice', description: '高质量 AI 配音', placeholder: 'your-api-key', authTypes: ['api_key'] },
  xunfei: { name: '讯飞', type: 'voice', description: '讯飞语音合成', placeholder: 'your-api-key', authTypes: ['api_key'] },
  'comfyui-music': { name: 'ComfyUI Music', type: 'music', description: '本地部署，支持 ACE-Step/Stable Audio', placeholder: 'http://localhost:8188', isLocal: true, authTypes: ['api_key'] },
  suno: { name: 'Suno', type: 'music', description: 'AI 音乐生成', placeholder: 'your-api-key', authTypes: ['api_key'] },
};

type ProviderId = keyof typeof AI_PROVIDERS;
type ProviderType = 'llm' | 'image' | 'video' | 'voice' | 'music';

interface SavedKey {
  id: string;
  provider: string;
  authType: AuthType;
  maskedKey?: string;
  oauthConnected?: boolean;
  tokenExpiresAt?: string;
  config?: {
    model?: string;
    [key: string]: unknown;
  };
  updatedAt: string;
}

const typeConfig: Record<ProviderType, { label: string; icon: React.ElementType }> = {
  llm: { label: 'LLM 模型', icon: Brain },
  image: { label: '图像生成', icon: Image },
  video: { label: '视频生成', icon: Video },
  voice: { label: '语音合成', icon: Mic },
  music: { label: '音乐生成', icon: Music },
};

export default function SettingsPage() {
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedAuthType, setSelectedAuthType] = useState<AuthType>('api_key');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  // Ollama model selection
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/api-keys');
      if (response.ok) {
        const data = await response.json();
        setSavedKeys(data);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
      toast.error('获取 API Key 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const fetchOllamaModels = async (baseUrl: string) => {
    if (!baseUrl.trim()) return;

    setLoadingModels(true);
    try {
      const response = await fetch(`/api/settings/ollama-models?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (response.ok) {
        const data = await response.json();
        setOllamaModels(data.models?.map((m: { name: string }) => m.name) || []);
      } else {
        setOllamaModels([]);
      }
    } catch {
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) return;

    // Validate local service URLs
    const isLocalProvider = AI_PROVIDERS[selectedProvider]?.isLocal;
    if (isLocalProvider) {
      const url = apiKeyInput.trim();
      // Check if it looks like a valid local URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        toast.error('请输入完整的服务地址，例如 http://localhost:11434');
        return;
      }
      // Warn if it looks like a remote URL (not localhost or local IP)
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const isLocal = hostname === 'localhost' ||
                        hostname === '127.0.0.1' ||
                        hostname.startsWith('192.168.') ||
                        hostname.startsWith('10.') ||
                        hostname.endsWith('.local');
        if (!isLocal) {
          const confirmed = confirm(`您输入的地址 "${hostname}" 看起来不是本地服务。\n\nOllama 等本地服务通常运行在 http://localhost:11434\n\n确定要使用这个地址吗？`);
          if (!confirmed) return;
        }
      } catch {
        toast.error('无效的 URL 格式');
        return;
      }
    }

    setSaving(true);
    try {
      const config = selectedProvider === 'ollama' && selectedModel
        ? { model: selectedModel }
        : undefined;

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          authType: 'api_key',
          apiKey: apiKeyInput,
          config,
        }),
      });

      if (response.ok) {
        const isLocal = AI_PROVIDERS[selectedProvider]?.isLocal;
        toast.success(isLocal ? '服务地址已保存' : 'API Key 已保存');
        setDialogOpen(false);
        setApiKeyInput('');
        setSelectedProvider(null);
        setSelectedAuthType('api_key');
        setSelectedModel('');
        setOllamaModels([]);
        fetchKeys();
      } else {
        const data = await response.json();
        toast.error(data.error || '保存失败');
      }
    } catch {
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleOAuthConnect = async (providerId: string) => {
    setOauthLoading(providerId);
    try {
      const response = await fetch(`/api/settings/oauth/authorize?provider=${providerId}`);
      const data = await response.json();

      if (response.ok && data.authUrl) {
        // Open OAuth authorization in new window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const authWindow = window.open(
          data.authUrl,
          'oauth_popup',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for OAuth callback message
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'oauth_callback' && event.data?.provider === providerId) {
            if (event.data.success) {
              toast.success(`${AI_PROVIDERS[providerId]?.name} 授权成功`);
              fetchKeys();
            } else {
              toast.error(event.data.error || '授权失败');
            }
            authWindow?.close();
            window.removeEventListener('message', handleMessage);
            setOauthLoading(null);
          }
        };

        window.addEventListener('message', handleMessage);

        // Fallback: check if window closed
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            setOauthLoading(null);
            fetchKeys(); // Refresh in case auth succeeded
          }
        }, 500);
      } else {
        toast.error(data.error || '获取授权链接失败');
        setOauthLoading(null);
      }
    } catch {
      toast.error('授权请求失败');
      setOauthLoading(null);
    }
  };

  const handleOAuthDisconnect = async (providerId: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys?provider=${providerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('已断开授权连接');
        fetchKeys();
      } else {
        const data = await response.json();
        toast.error(data.error || '断开连接失败');
      }
    } catch {
      toast.error('断开连接失败');
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      const response = await fetch(`/api/settings/api-keys?provider=${provider}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('API Key 已删除');
        fetchKeys();
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败，请稍后重试');
    }
  };

  const getProvidersByType = (type: ProviderType) => {
    return Object.entries(AI_PROVIDERS)
      .filter(([, config]) => config.type === type)
      .map(([id, config]) => ({ id: id as ProviderId, ...config }));
  };

  const isProviderConfigured = (providerId: string) => {
    return savedKeys.some((key) => key.provider === providerId);
  };

  const getKeyForProvider = (providerId: string) => {
    return savedKeys.find((key) => key.provider === providerId);
  };

  const renderProviderCard = (provider: { id: ProviderId; name: string; description: string; authTypes: AuthType[]; supportsOAuth?: boolean; isLocal?: boolean }) => {
    const configured = isProviderConfigured(provider.id);
    const savedKey = getKeyForProvider(provider.id);
    const supportsOAuth = provider.authTypes.includes('oauth');
    const isOAuthConnected = savedKey?.authType === 'oauth' && savedKey?.oauthConnected;
    const isLocal = provider.isLocal;

    return (
      <div
        key={provider.id}
        className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${configured ? 'bg-green-900/50' : 'bg-slate-700'}`}>
            {isOAuthConnected ? (
              <LinkIcon className={`h-4 w-4 ${configured ? 'text-green-400' : 'text-slate-400'}`} />
            ) : isLocal ? (
              <Server className={`h-4 w-4 ${configured ? 'text-green-400' : 'text-slate-400'}`} />
            ) : (
              <Key className={`h-4 w-4 ${configured ? 'text-green-400' : 'text-slate-400'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{provider.name}</span>
              {configured && <Check className="h-4 w-4 text-green-400" />}
              {isLocal && (
                <span className="text-xs bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded">
                  本地
                </span>
              )}
              {supportsOAuth && (
                <span className="text-xs bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded">
                  支持授权
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{provider.description}</p>
            {savedKey && (
              <div className="text-xs text-slate-500 font-mono mt-1">
                {isOAuthConnected ? (
                  <span className="text-blue-400">已通过 OAuth 授权连接</span>
                ) : (
                  <span>{savedKey.maskedKey}</span>
                )}
                {savedKey.config?.model && (
                  <span className="ml-2 text-emerald-400">模型: {savedKey.config.model}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* API Key / 服务地址 配置按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedProvider(provider.id);
              setSelectedAuthType('api_key');
              setDialogOpen(true);
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isLocal ? (
              <>
                <Server className="h-3 w-3 mr-1" />
                {configured && savedKey?.authType === 'api_key' ? '更新地址' : '服务地址'}
              </>
            ) : (
              <>
                <Key className="h-3 w-3 mr-1" />
                {configured && savedKey?.authType === 'api_key' ? '更新 Key' : 'API Key'}
              </>
            )}
          </Button>

          {/* OAuth 授权按钮 */}
          {supportsOAuth && (
            isOAuthConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOAuthDisconnect(provider.id)}
                className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                断开授权
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOAuthConnect(provider.id)}
                disabled={oauthLoading === provider.id}
                className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
              >
                {oauthLoading === provider.id ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <LogIn className="h-3 w-3 mr-1" />
                )}
                授权登录
              </Button>
            )
          )}

          {/* 删除按钮 */}
          {configured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteKey(provider.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">设置</h1>
          <p className="text-slate-400">管理您的 AI 服务配置</p>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key 管理
          </CardTitle>
          <CardDescription className="text-slate-400">
            配置各 AI 服务的 API Key，所有密钥均加密存储
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="llm">
            <TabsList className="bg-slate-800 border-slate-700 mb-6">
              {Object.entries(typeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <TabsTrigger
                    key={type}
                    value={type}
                    className="data-[state=active]:bg-slate-700"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {config.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.keys(typeConfig).map((type) => (
              <TabsContent key={type} value={type} className="space-y-3">
                {getProvidersByType(type as ProviderType).map(renderProviderCard)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          {(() => {
            const isLocalProvider = selectedProvider ? AI_PROVIDERS[selectedProvider]?.isLocal : false;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white">
                    配置 {selectedProvider && AI_PROVIDERS[selectedProvider].name}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {isLocalProvider
                      ? selectedProvider === 'ollama'
                        ? '输入 Ollama 服务地址，默认是 http://localhost:11434'
                        : '输入本地服务的地址（如 http://localhost:8188）'
                      : '输入您的 API Key，密钥将加密存储在服务器'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-slate-200">
                      {isLocalProvider ? '服务地址' : 'API Key'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="apiKey"
                        type={isLocalProvider ? 'url' : 'password'}
                        placeholder={selectedProvider ? AI_PROVIDERS[selectedProvider].placeholder : ''}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="bg-slate-900/50 border-slate-600 text-white flex-1"
                      />
                      {selectedProvider === 'ollama' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fetchOllamaModels(apiKeyInput)}
                          disabled={!apiKeyInput.trim() || loadingModels}
                          className="border-slate-600 text-slate-300"
                        >
                          {loadingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : '获取模型'}
                        </Button>
                      )}
                    </div>
                    {isLocalProvider && selectedProvider && (
                      <p className="text-xs text-slate-500">
                        确保 {AI_PROVIDERS[selectedProvider].name} 服务已启动并可访问
                      </p>
                    )}
                  </div>

                  {/* Ollama model selection */}
                  {selectedProvider === 'ollama' && ollamaModels.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="model" className="text-slate-200">
                        选择模型
                      </Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                          <SelectValue placeholder="选择一个模型" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {ollamaModels.map((model) => (
                            <SelectItem key={model} value={model} className="text-white">
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        已找到 {ollamaModels.length} 个模型
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="border-slate-600 text-slate-300"
                  >
                    取消
                  </Button>
                  <Button onClick={handleSaveKey} disabled={saving || !apiKeyInput.trim()}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存'
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
