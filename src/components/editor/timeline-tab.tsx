'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Layers,
  GripVertical,
  Trash2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface Scene {
  id: string;
  orderIndex: number;
  description: string;
}

interface Asset {
  id: string;
  sceneId: string | null;
  type: 'video' | 'audio' | 'music' | 'image';
  url: string;
  prompt: string | null;
  isSelected: boolean;
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
  } | null;
}

interface TimelineClip {
  id: string;
  assetId: string;
  type: 'video' | 'audio' | 'music';
  url: string;
  startTime: number; // In seconds
  duration: number;
  trackIndex: number;
  sceneId?: string;
}

interface TimelineTabProps {
  projectId: string;
}

const TRACK_HEIGHT = 60;
const PIXELS_PER_SECOND = 50;

export function TimelineTab({ projectId }: TimelineTabProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoAssets, setVideoAssets] = useState<Record<string, Asset[]>>({});
  const [audioAssets, setAudioAssets] = useState<Record<string, Asset[]>>({});
  const [musicAssets, setMusicAssets] = useState<Asset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

            // Auto-generate timeline clips from selected assets
            const autoClips: TimelineClip[] = [];
            let currentStartTime = 0;

            scenesData.forEach((scene: Scene) => {
              const sceneVideos = videos[scene.id] || [];
              const selectedVideo = sceneVideos.find((v) => v.isSelected);

              if (selectedVideo) {
                const duration = selectedVideo.metadata?.duration || 5;
                autoClips.push({
                  id: `clip-${selectedVideo.id}`,
                  assetId: selectedVideo.id,
                  type: 'video',
                  url: selectedVideo.url,
                  startTime: currentStartTime,
                  duration,
                  trackIndex: 0,
                  sceneId: scene.id,
                });

                // Add corresponding audio if exists
                const sceneAudios = audios[scene.id] || [];
                const selectedAudio = sceneAudios.find((a) => a.isSelected);
                if (selectedAudio) {
                  autoClips.push({
                    id: `clip-${selectedAudio.id}`,
                    assetId: selectedAudio.id,
                    type: 'audio',
                    url: selectedAudio.url,
                    startTime: currentStartTime,
                    duration: selectedAudio.metadata?.duration || duration,
                    trackIndex: 1,
                    sceneId: scene.id,
                  });
                }

                currentStartTime += duration;
              }
            });

            setClips(autoClips);
          }
        }
      }

      // Fetch music assets
      const musicResponse = await fetch(`/api/projects/${projectId}/assets?type=music`);
      if (musicResponse.ok) {
        const musicData = await musicResponse.json();
        setMusicAssets(musicData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalDuration = clips.reduce(
    (max, clip) => Math.max(max, clip.startTime + clip.duration),
    0
  );

  const tracks = [
    { id: 'video', name: '视频轨道', color: 'bg-blue-600' },
    { id: 'audio', name: '配音轨道', color: 'bg-purple-600' },
    { id: 'music', name: '音乐轨道', color: 'bg-orange-600' },
  ];

  function handlePlayPause() {
    setIsPlaying(!isPlaying);
    // In a real implementation, this would control video/audio playback
  }

  function handleSeek(time: number) {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  }

  function handleClipDragStart(clipId: string) {
    setDraggedClip(clipId);
  }

  function handleClipDragEnd() {
    setDraggedClip(null);
  }

  function handleClipMove(clipId: string, newStartTime: number) {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === clipId ? { ...clip, startTime: Math.max(0, newStartTime) } : clip
      )
    );
  }

  function handleDeleteClip(clipId: string) {
    setClips((prev) => prev.filter((clip) => clip.id !== clipId));
    toast.success('已移除片段');
  }

  function handleAddMusicToTimeline(music: Asset) {
    const newClip: TimelineClip = {
      id: `clip-${music.id}-${Date.now()}`,
      assetId: music.id,
      type: 'music',
      url: music.url,
      startTime: 0,
      duration: music.metadata?.duration || 30,
      trackIndex: 2,
    };
    setClips((prev) => [...prev, newClip]);
    toast.success('已添加背景音乐');
  }

  async function handleSaveTimeline() {
    try {
      const response = await fetch(`/api/projects/${projectId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: clips,
          duration: totalDuration,
        }),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      toast.success('时间线已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">时间线编辑器</CardTitle>
          <CardDescription className="text-slate-400">
            可视化编排视频、配音和背景音乐
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">暂无素材</h3>
            <p className="text-slate-400 max-w-md">
              请先在视频标签页生成并选择视频片段，系统将自动创建时间线
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview and Controls */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Preview Thumbnail */}
            <div className="w-48 h-28 bg-slate-800 rounded overflow-hidden flex-shrink-0">
              {clips.length > 0 && clips[0].type === 'video' && (
                <video
                  ref={videoRef}
                  src={clips[0].url}
                  className="w-full h-full object-cover"
                  muted={isMuted}
                />
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSeek(0)}
                className="text-slate-400"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handlePlayPause}
                className="bg-blue-600 hover:bg-blue-700 h-10 w-10 rounded-full p-0"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSeek(totalDuration)}
                className="text-slate-400"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-400"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Time Display */}
            <div className="text-sm text-slate-300 font-mono">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>

            {/* Actions */}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveTimeline}
                className="border-slate-600 text-slate-300"
              >
                保存时间线
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Editor */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-base">时间线</CardTitle>
              <CardDescription className="text-slate-400">
                拖拽调整片段位置和顺序
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Time Ruler */}
          <div className="flex border-b border-slate-700">
            <div className="w-32 flex-shrink-0 bg-slate-800/50" />
            <div
              className="flex-1 h-6 relative overflow-hidden"
              style={{ minWidth: totalDuration * PIXELS_PER_SECOND }}
            >
              {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-slate-700 text-xs text-slate-500 pl-1"
                  style={{ left: i * PIXELS_PER_SECOND }}
                >
                  {formatTime(i)}
                </div>
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 h-full bg-red-500 z-20"
                style={{ left: currentTime * PIXELS_PER_SECOND }}
              />
            </div>
          </div>

          {/* Tracks */}
          <div
            ref={timelineRef}
            className="overflow-x-auto"
            onClick={(e) => {
              if (timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left - 128; // Subtract track label width
                const time = x / PIXELS_PER_SECOND;
                handleSeek(time);
              }
            }}
          >
            {tracks.map((track, trackIndex) => {
              const trackClips = clips.filter((c) => c.trackIndex === trackIndex);

              return (
                <div
                  key={track.id}
                  className="flex border-b border-slate-700 last:border-b-0"
                  style={{ height: TRACK_HEIGHT }}
                >
                  {/* Track Label */}
                  <div className="w-32 flex-shrink-0 bg-slate-800/50 flex items-center px-3 border-r border-slate-700">
                    <span className="text-sm text-slate-400">{track.name}</span>
                  </div>

                  {/* Track Content */}
                  <div
                    className="flex-1 relative bg-slate-900/30"
                    style={{ minWidth: totalDuration * PIXELS_PER_SECOND }}
                  >
                    {trackClips.map((clip) => (
                      <div
                        key={clip.id}
                        className={`absolute top-1 bottom-1 ${track.color} rounded cursor-move flex items-center px-2 group transition-opacity ${
                          draggedClip === clip.id ? 'opacity-50' : ''
                        }`}
                        style={{
                          left: clip.startTime * PIXELS_PER_SECOND,
                          width: clip.duration * PIXELS_PER_SECOND,
                        }}
                        draggable
                        onDragStart={() => handleClipDragStart(clip.id)}
                        onDragEnd={handleClipDragEnd}
                      >
                        <GripVertical className="h-4 w-4 text-white/50 flex-shrink-0" />
                        <span className="text-xs text-white truncate ml-1">
                          {clip.duration.toFixed(1)}s
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClip(clip.id);
                          }}
                          className="absolute right-1 top-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-white/70 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Playhead line on tracks */}
                    <div
                      className="absolute top-0 w-0.5 h-full bg-red-500/50 pointer-events-none"
                      style={{ left: currentTime * PIXELS_PER_SECOND }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Music Library */}
      {musicAssets.length > 0 && (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">可用音乐</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {musicAssets.map((music, index) => (
                <Button
                  key={music.id}
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMusicToTimeline(music)}
                  className="border-slate-600 text-slate-300"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  音乐 {index + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
