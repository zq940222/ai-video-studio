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
  Download,
  Play,
  Check,
  AlertCircle,
  Video,
  Music,
  Mic,
} from 'lucide-react';
import { toast } from 'sonner';

interface Asset {
  id: string;
  sceneId: string | null;
  type: string;
  url: string;
  isSelected: boolean;
  metadata: {
    duration?: number;
  } | null;
}

interface Scene {
  id: string;
  orderIndex: number;
  description: string;
}

interface ExportTabProps {
  projectId: string;
}

type Resolution = '1080p' | '720p' | '480p';
type Format = 'mp4' | 'webm';

export function ExportTab({ projectId }: ExportTabProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoAssets, setVideoAssets] = useState<Record<string, Asset[]>>({});
  const [audioAssets, setAudioAssets] = useState<Record<string, Asset[]>>({});
  const [musicAssets, setMusicAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [format, setFormat] = useState<Format>('mp4');
  const [selectedMusicId, setSelectedMusicId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    try {
      // Fetch scenes
      const scenesResponse = await fetch(`/api/projects/${projectId}/scenes`);
      if (scenesResponse.ok) {
        const scenesData = await scenesResponse.json();
        setScenes(scenesData);

        if (scenesData.length > 0) {
          const sceneIds = scenesData.map((s: Scene) => s.id);

          // Fetch all assets
          const assetsResponse = await fetch(
            `/api/projects/${projectId}/assets?sceneIds=${sceneIds.join(',')}`
          );
          if (assetsResponse.ok) {
            const assetsData: Asset[] = await assetsResponse.json();

            const videos: Record<string, Asset[]> = {};
            const audios: Record<string, Asset[]> = {};

            assetsData.forEach((asset) => {
              if (!asset.sceneId) return;

              if (asset.type === 'video') {
                if (!videos[asset.sceneId]) videos[asset.sceneId] = [];
                videos[asset.sceneId].push(asset);
              } else if (asset.type === 'audio') {
                if (!audios[asset.sceneId]) audios[asset.sceneId] = [];
                audios[asset.sceneId].push(asset);
              }
            });

            setVideoAssets(videos);
            setAudioAssets(audios);
          }
        }
      }

      // Fetch music assets (project-level)
      const musicResponse = await fetch(`/api/projects/${projectId}/assets?type=music`);
      if (musicResponse.ok) {
        const musicData = await musicResponse.json();
        setMusicAssets(musicData);
        if (musicData.length > 0) {
          setSelectedMusicId(musicData[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Check readiness
  const scenesWithVideo = scenes.filter((scene) => {
    const sceneVideos = videoAssets[scene.id] || [];
    return sceneVideos.some((v) => v.isSelected);
  });
  const isReady = scenesWithVideo.length > 0;
  const totalDuration = scenesWithVideo.reduce((total, scene) => {
    const videos = videoAssets[scene.id] || [];
    const selectedVideo = videos.find((v) => v.isSelected);
    return total + (selectedVideo?.metadata?.duration || 5);
  }, 0);

  async function handleExport() {
    if (!isReady) {
      toast.error('请先完成视频生成');
      return;
    }

    setExporting(true);
    setExportProgress(0);

    try {
      // Simulate export progress (in real implementation, this would poll a backend task)
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          resolution,
          format,
          musicAssetId: selectedMusicId || undefined,
          scenes: scenesWithVideo.map((scene) => {
            const videos = videoAssets[scene.id] || [];
            const audios = audioAssets[scene.id] || [];
            const selectedVideo = videos.find((v) => v.isSelected);
            const selectedAudio = audios.find((a) => a.isSelected);

            return {
              sceneId: scene.id,
              videoAssetId: selectedVideo?.id,
              audioAssetId: selectedAudio?.id,
            };
          }),
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导出失败');
      }

      const data = await response.json();
      setExportProgress(100);

      // Download the file
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `${projectId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success('导出成功！');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">导出合成</CardTitle>
          <CardDescription className="text-slate-400">
            将所有素材合成为最终视频
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Readiness Check */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">素材检查</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {scenesWithVideo.length > 0 ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-sm text-slate-300">
                  视频片段: {scenesWithVideo.length}/{scenes.length} 个分镜已完成
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-400">
                  预计时长: {totalDuration}秒
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-400">
                  背景音乐: {musicAssets.length > 0 ? '已添加' : '无'}
                </span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">导出设置</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">分辨率:</span>
                <Select
                  value={resolution}
                  onValueChange={(v) => setResolution(v as Resolution)}
                >
                  <SelectTrigger className="w-24 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">格式:</span>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as Format)}
                >
                  <SelectTrigger className="w-24 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp4">MP4</SelectItem>
                    <SelectItem value="webm">WebM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {musicAssets.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">背景音乐:</span>
                  <Select value={selectedMusicId} onValueChange={setSelectedMusicId}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="选择音乐" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">无背景音乐</SelectItem>
                      {musicAssets.map((music, index) => (
                        <SelectItem key={music.id} value={music.id}>
                          音乐 {index + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Export Progress */}
          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">正在合成视频...</span>
                <span className="text-slate-400">{exportProgress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={!isReady || exporting}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {exporting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                合成中...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                导出视频
              </>
            )}
          </Button>

          {!isReady && (
            <p className="text-center text-sm text-yellow-500">
              请先在视频标签页生成并选择视频片段
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">片段预览</CardTitle>
          <CardDescription className="text-slate-400">
            已选择的视频片段顺序
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scenesWithVideo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-400">暂无视频片段</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {scenesWithVideo.map((scene, index) => {
                const videos = videoAssets[scene.id] || [];
                const selectedVideo = videos.find((v) => v.isSelected);

                return (
                  <div key={scene.id} className="relative">
                    <div className="absolute -top-2 -left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full z-10">
                      {index + 1}
                    </div>
                    {selectedVideo && (
                      <video
                        src={selectedVideo.url}
                        className="w-full aspect-video object-cover rounded border border-slate-700"
                        muted
                        loop
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    )}
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      #{scene.orderIndex}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
