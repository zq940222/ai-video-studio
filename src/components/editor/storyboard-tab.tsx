'use client';

import { useState, useEffect } from 'react';
import { StoryboardPanel } from './storyboard-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Image, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface Scene {
  id: string;
  scriptId: string;
  orderIndex: number;
  description: string;
  dialogue: string | null;
  duration: number | null;
  imagePrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Asset {
  id: string;
  projectId: string;
  sceneId: string | null;
  type: string;
  source: string;
  provider: string | null;
  prompt: string | null;
  url: string;
  thumbnailUrl: string | null;
  isSelected: boolean;
  createdAt: Date;
}

interface StoryboardTabProps {
  projectId: string;
  hasScript: boolean;
}

export function StoryboardTab({ projectId, hasScript }: StoryboardTabProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Record<string, Asset[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (hasScript) {
      fetchScenes();
    } else {
      setLoading(false);
    }
  }, [projectId, hasScript]);

  async function fetchScenes() {
    try {
      const response = await fetch(`/api/projects/${projectId}/scenes`);
      if (response.ok) {
        const data = await response.json();
        setScenes(data);
        // Fetch assets for each scene
        if (data.length > 0) {
          await fetchAssets(data.map((s: Scene) => s.id));
        }
      }
    } catch (error) {
      console.error('Failed to fetch scenes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAssets(sceneIds: string[]) {
    try {
      const response = await fetch(`/api/projects/${projectId}/assets?sceneIds=${sceneIds.join(',')}`);
      if (response.ok) {
        const data: Asset[] = await response.json();
        // Group assets by sceneId
        const grouped: Record<string, Asset[]> = {};
        data.forEach((asset) => {
          if (asset.sceneId) {
            if (!grouped[asset.sceneId]) {
              grouped[asset.sceneId] = [];
            }
            grouped[asset.sceneId].push(asset);
          }
        });
        setAssets(grouped);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    }
  }

  async function handleGenerateStoryboard() {
    setGenerating(true);
    try {
      const response = await fetch('/api/generate/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成分镜失败');
      }

      const data = await response.json();
      setScenes(data.scenes);
      toast.success('分镜生成成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成分镜失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateImage(sceneId: string, prompt: string) {
    try {
      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sceneId,
          prompt,
          width: 1024,
          height: 576, // 16:9 aspect ratio
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成图片失败');
      }

      const data = await response.json();
      // Add new asset to the scene's assets
      setAssets((prev) => ({
        ...prev,
        [sceneId]: [...(prev[sceneId] || []), data.asset],
      }));
      toast.success('图片生成成功');
      return data.asset;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成图片失败');
      throw error;
    }
  }

  async function handleSelectAsset(sceneId: string, assetId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${assetId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('选择图片失败');
      }

      // Update local state
      setAssets((prev) => ({
        ...prev,
        [sceneId]: prev[sceneId]?.map((a) => ({
          ...a,
          isSelected: a.id === assetId,
        })) || [],
      }));
      toast.success('已选择该图片');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '选择图片失败');
    }
  }

  async function handleUpdatePrompt(sceneId: string, newPrompt: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePrompt: newPrompt }),
      });

      if (!response.ok) {
        throw new Error('更新提示词失败');
      }

      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, imagePrompt: newPrompt } : s))
      );
      toast.success('提示词已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新提示词失败');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!hasScript) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">分镜设计</CardTitle>
          <CardDescription className="text-slate-400">
            根据剧本生成分镜概念图，支持 AI 生成和手动调整
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">请先完成剧本</h3>
            <p className="text-slate-400 max-w-md">
              完成剧本编写后，系统将自动拆解分镜并生成概念图
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scenes.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">分镜设计</CardTitle>
          <CardDescription className="text-slate-400">
            根据剧本生成分镜概念图，支持 AI 生成和手动调整
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">生成分镜脚本</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              根据剧本内容，AI 将自动拆解场景并生成分镜描述和图片提示词
            </p>
            <Button
              onClick={handleGenerateStoryboard}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  生成分镜脚本
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <StoryboardPanel
      scenes={scenes}
      assets={assets}
      onGenerateImage={handleGenerateImage}
      onSelectAsset={handleSelectAsset}
      onUpdatePrompt={handleUpdatePrompt}
      onRegenerateStoryboard={handleGenerateStoryboard}
      isRegenerating={generating}
    />
  );
}
