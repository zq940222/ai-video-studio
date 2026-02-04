'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Music, Play, Pause, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Asset {
  id: string;
  type: string;
  url: string;
  prompt: string | null;
  metadata: {
    duration?: number;
    style?: string;
  } | null;
  createdAt: Date;
}

interface MusicStyle {
  name: string;
  description: string;
}

interface MusicTabProps {
  projectId: string;
}

export function MusicTab({ projectId }: MusicTabProps) {
  const [musicAssets, setMusicAssets] = useState<Asset[]>([]);
  const [musicStyles, setMusicStyles] = useState<Record<string, MusicStyle>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('cinematic-emotional');
  const [duration, setDuration] = useState<number>(30);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchData();

    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [projectId]);

  async function fetchData() {
    try {
      // Fetch music styles
      const stylesResponse = await fetch('/api/generate/music');
      if (stylesResponse.ok) {
        const stylesData = await stylesResponse.json();
        setMusicStyles(stylesData.styles || {});
      }

      // Fetch existing music assets
      const assetsResponse = await fetch(`/api/projects/${projectId}/assets?type=music`);
      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        setMusicAssets(assetsData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateMusic() {
    if (!prompt.trim()) {
      toast.error('请输入音乐描述');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: prompt.trim(),
          style: selectedStyle,
          duration,
          instrumental: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成音乐失败');
      }

      const data = await response.json();
      setMusicAssets((prev) => [data.asset, ...prev]);
      setPrompt('');
      toast.success('音乐生成成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成音乐失败');
    } finally {
      setGenerating(false);
    }
  }

  function handlePlayAudio(assetId: string, url: string) {
    if (audioElement) {
      audioElement.pause();
    }

    if (playingAudio === assetId) {
      setPlayingAudio(null);
      return;
    }

    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setPlayingAudio(null);
    setAudioElement(audio);
    setPlayingAudio(assetId);
  }

  async function handleDeleteMusic(assetId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      setMusicAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (playingAudio === assetId) {
        audioElement?.pause();
        setPlayingAudio(null);
      }
      toast.success('已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
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
      {/* Generate Music Card */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">生成背景音乐</CardTitle>
          <CardDescription className="text-slate-400">
            根据描述生成匹配场景氛围的背景音乐
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">音乐描述</label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：温馨浪漫的钢琴曲，适合爱情场景..."
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
            />
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">风格:</span>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(musicStyles).map(([id, style]) => (
                    <SelectItem key={id} value={id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">时长:</span>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger className="w-24 bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15秒</SelectItem>
                  <SelectItem value="30">30秒</SelectItem>
                  <SelectItem value="60">60秒</SelectItem>
                  <SelectItem value="120">2分钟</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateMusic}
            disabled={generating || !prompt.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中（约1-3分钟）...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                生成配乐
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Music Library */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">音乐库</CardTitle>
          <CardDescription className="text-slate-400">
            已生成的背景音乐 ({musicAssets.length})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {musicAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Music className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-400">暂无音乐</p>
              <p className="text-sm text-slate-500">生成第一首背景音乐吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {musicAssets.map((music) => (
                <div
                  key={music.id}
                  className="flex items-center gap-4 bg-slate-800/50 rounded-lg p-3"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePlayAudio(music.id, music.url)}
                    className="h-10 w-10 p-0 rounded-full bg-orange-600 hover:bg-orange-700"
                  >
                    {playingAudio === music.id ? (
                      <Pause className="h-5 w-5 text-white" />
                    ) : (
                      <Play className="h-5 w-5 text-white" />
                    )}
                  </Button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{music.prompt}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{music.metadata?.style}</span>
                      {music.metadata?.duration && (
                        <span>• {music.metadata.duration}秒</span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteMusic(music.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
