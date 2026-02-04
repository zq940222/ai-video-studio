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
import { toast } from 'sonner';
import {
  Key,
  Brain,
  Image,
  Video,
  Mic,
  Music,
  Plus,
  Trash2,
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// Provider configuration (should match server-side)
const AI_PROVIDERS = {
  openai: { name: 'OpenAI', type: 'llm', description: 'GPT-4, GPT-3.5 等模型', placeholder: 'sk-...' },
  anthropic: { name: 'Anthropic', type: 'llm', description: 'Claude 系列模型', placeholder: 'sk-ant-...' },
  qwen: { name: '通义千问', type: 'llm', description: '阿里云通义千问', placeholder: 'sk-...' },
  comfyui: { name: 'ComfyUI', type: 'image', description: '本地部署，支持 FLUX/SD', placeholder: 'http://localhost:8188', isLocal: true },
  kling: { name: '可灵', type: 'video', description: '快手可灵视频生成', placeholder: 'your-api-key' },
  runway: { name: 'Runway', type: 'video', description: 'Runway Gen-2/Gen-3', placeholder: 'your-api-key' },
  jimeng: { name: '即梦', type: 'video', description: '字节跳动即梦', placeholder: 'your-api-key' },
  elevenlabs: { name: 'ElevenLabs', type: 'voice', description: '高质量 AI 配音', placeholder: 'your-api-key' },
  xunfei: { name: '讯飞', type: 'voice', description: '讯飞语音合成', placeholder: 'your-api-key' },
  suno: { name: 'Suno', type: 'music', description: 'AI 音乐生成', placeholder: 'your-api-key' },
} as const;

type ProviderId = keyof typeof AI_PROVIDERS;
type ProviderType = 'llm' | 'image' | 'video' | 'voice' | 'music';

interface SavedKey {
  id: string;
  provider: string;
  maskedKey: string;
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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKeyInput.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput,
        }),
      });

      if (response.ok) {
        toast.success('API Key 已保存');
        setDialogOpen(false);
        setApiKeyInput('');
        setSelectedProvider(null);
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

  const renderProviderCard = (provider: { id: ProviderId; name: string; description: string }) => {
    const configured = isProviderConfigured(provider.id);
    const savedKey = getKeyForProvider(provider.id);

    return (
      <div
        key={provider.id}
        className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${configured ? 'bg-green-900/50' : 'bg-slate-700'}`}>
            <Key className={`h-4 w-4 ${configured ? 'text-green-400' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{provider.name}</span>
              {configured && <Check className="h-4 w-4 text-green-400" />}
            </div>
            <p className="text-sm text-slate-400">{provider.description}</p>
            {savedKey && (
              <p className="text-xs text-slate-500 font-mono mt-1">{savedKey.maskedKey}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedProvider(provider.id);
              setDialogOpen(true);
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {configured ? '更新' : '配置'}
          </Button>
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
          <DialogHeader>
            <DialogTitle className="text-white">
              配置 {selectedProvider && AI_PROVIDERS[selectedProvider].name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              输入您的 API Key，密钥将加密存储在服务器
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-slate-200">
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={selectedProvider ? AI_PROVIDERS[selectedProvider].placeholder : ''}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
