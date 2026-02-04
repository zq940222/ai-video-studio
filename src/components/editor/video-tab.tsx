'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Video,
  Play,
  Wand2,
  Check,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Scene {
  id: string;
  orderIndex: number;
  description: string;
  imagePrompt: string | null;
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
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    sourceAssetId?: string;
  } | null;
  createdAt: Date;
}

interface VideoTabProps {
  projectId: string;
  hasScenes: boolean;
}

export function VideoTab({ projectId, hasScenes }: VideoTabProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [imageAssets, setImageAssets] = useState<Record<string, Asset[]>>({});
  const [videoAssets, setVideoAssets] = useState<Record<string, Asset[]>>({});
  const [loading, setLoading] = useState(true);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  useEffect(() => {
    if (hasScenes) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [projectId, hasScenes]);

  async function fetchData() {
    try {
      // Fetch scenes
      const scenesResponse = await fetch(`/api/projects/${projectId}/scenes`);
      if (scenesResponse.ok) {
        const scenesData = await scenesResponse.json();
        setScenes(scenesData);

        // Fetch all assets
        if (scenesData.length > 0) {
          const sceneIds = scenesData.map((s: Scene) => s.id);
          const assetsResponse = await fetch(
            `/api/projects/${projectId}/assets?sceneIds=${sceneIds.join(',')}`
          );
          if (assetsResponse.ok) {
            const assetsData: Asset[] = await assetsResponse.json();

            // Group by scene and type
            const images: Record<string, Asset[]> = {};
            const videos: Record<string, Asset[]> = {};

            assetsData.forEach((asset) => {
              if (!asset.sceneId) return;

              if (asset.type === 'image') {
                if (!images[asset.sceneId]) images[asset.sceneId] = [];
                images[asset.sceneId].push(asset);
              } else if (asset.type === 'video') {
                if (!videos[asset.sceneId]) videos[asset.sceneId] = [];
                videos[asset.sceneId].push(asset);
              }
            });

            setImageAssets(images);
            setVideoAssets(videos);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVideo(sceneId: string, imageAssetId: string) {
    setGeneratingSceneId(sceneId);
    try {
      const scene = scenes.find((s) => s.id === sceneId);
      const response = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sceneId,
          assetId: imageAssetId,
          prompt: scene?.imagePrompt || scene?.description || 'cinematic motion',
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成视频失败');
      }

      const data = await response.json();
      // Add new video asset
      setVideoAssets((prev) => ({
        ...prev,
        [sceneId]: [...(prev[sceneId] || []), data.asset],
      }));
      toast.success('视频生成成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成视频失败');
    } finally {
      setGeneratingSceneId(null);
    }
  }

  async function handleSelectVideo(sceneId: string, assetId: string) {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/assets/${assetId}/select`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('选择视频失败');
      }

      // Update local state
      setVideoAssets((prev) => ({
        ...prev,
        [sceneId]:
          prev[sceneId]?.map((a) => ({
            ...a,
            isSelected: a.id === assetId,
          })) || [],
      }));
      toast.success('已选择该视频');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '选择视频失败');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!hasScenes) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">视频生成</CardTitle>
          <CardDescription className="text-slate-400">
            将分镜概念图转换为视频片段
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">请先完成分镜</h3>
            <p className="text-slate-400 max-w-md">
              完成分镜设计后，可以将概念图转换为视频片段
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if any scene has selected images
  const scenesWithImages = scenes.filter((scene) => {
    const sceneImages = imageAssets[scene.id] || [];
    return sceneImages.some((a) => a.isSelected);
  });

  if (scenesWithImages.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">视频生成</CardTitle>
          <CardDescription className="text-slate-400">
            将分镜概念图转换为视频片段
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">请先选择分镜图片</h3>
            <p className="text-slate-400 max-w-md">
              在分镜设计中选择要用于视频生成的概念图
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalScenes = scenesWithImages.length;
  const completedScenes = scenesWithImages.filter((s) => {
    const sceneVideos = videoAssets[s.id] || [];
    return sceneVideos.some((a) => a.isSelected);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">视频生成</CardTitle>
              <CardDescription className="text-slate-400">
                共 {totalScenes} 个分镜待生成，已完成 {completedScenes} 个
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">画面比例:</span>
                <Select
                  value={aspectRatio}
                  onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}
                >
                  <SelectTrigger className="w-28 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 横屏</SelectItem>
                    <SelectItem value="9:16">9:16 竖屏</SelectItem>
                    <SelectItem value="1:1">1:1 方形</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${(completedScenes / totalScenes) * 100}%` }}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Scene Cards */}
      <div className="grid gap-4">
        {scenesWithImages.map((scene) => {
          const sceneImages = imageAssets[scene.id] || [];
          const selectedImage = sceneImages.find((a) => a.isSelected);
          const sceneVideos = videoAssets[scene.id] || [];
          const isGenerating = generatingSceneId === scene.id;

          return (
            <Card key={scene.id} className="border-slate-700 bg-slate-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                    #{scene.orderIndex}
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-400 line-clamp-2">
                  {scene.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Source Image and Generate Button */}
                <div className="flex items-start gap-4">
                  {selectedImage && (
                    <div className="flex-shrink-0">
                      <p className="text-xs text-slate-500 mb-1">源图片</p>
                      <div className="w-32 h-20 rounded overflow-hidden border border-slate-600">
                        <img
                          src={selectedImage.url}
                          alt={`Scene ${scene.orderIndex}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    <Button
                      onClick={() =>
                        selectedImage &&
                        handleGenerateVideo(scene.id, selectedImage.id)
                      }
                      disabled={isGenerating || !selectedImage}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中（约2-5分钟）...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          生成视频
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Generated Videos */}
                {sceneVideos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300">
                      生成的视频 ({sceneVideos.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sceneVideos.map((video) => (
                        <div
                          key={video.id}
                          className={`relative group rounded overflow-hidden cursor-pointer border-2 transition-colors ${
                            video.isSelected
                              ? 'border-green-500'
                              : 'border-transparent hover:border-slate-500'
                          }`}
                          onClick={() => handleSelectVideo(scene.id, video.id)}
                        >
                          <video
                            src={video.url}
                            className="w-full aspect-video object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                          {video.isSelected && (
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                          {video.metadata?.duration && (
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                              {video.metadata.duration}s
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
