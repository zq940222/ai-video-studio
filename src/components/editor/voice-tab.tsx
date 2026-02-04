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
import { Loader2, Mic, Play, Pause, Wand2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Scene {
  id: string;
  orderIndex: number;
  description: string;
  dialogue: string | null;
}

interface Asset {
  id: string;
  sceneId: string | null;
  type: string;
  url: string;
  prompt: string | null;
  metadata: {
    duration?: number;
    voiceId?: string;
  } | null;
}

interface VoiceStyle {
  name: string;
  description: string;
}

interface VoiceTabProps {
  projectId: string;
  hasScript: boolean;
}

export function VoiceTab({ projectId, hasScript }: VoiceTabProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [audioAssets, setAudioAssets] = useState<Record<string, Asset[]>>({});
  const [voiceStyles, setVoiceStyles] = useState<Record<string, VoiceStyle>>({});
  const [loading, setLoading] = useState(true);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('female-narrator');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (hasScript) {
      fetchData();
    } else {
      setLoading(false);
    }

    // Cleanup audio on unmount
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [projectId, hasScript]);

  async function fetchData() {
    try {
      // Fetch voice styles
      const stylesResponse = await fetch('/api/generate/voice');
      if (stylesResponse.ok) {
        const stylesData = await stylesResponse.json();
        setVoiceStyles(stylesData.styles || {});
      }

      // Fetch scenes with dialogues
      const scenesResponse = await fetch(`/api/projects/${projectId}/scenes`);
      if (scenesResponse.ok) {
        const scenesData = await scenesResponse.json();
        // Filter scenes that have dialogue
        const scenesWithDialogue = scenesData.filter((s: Scene) => s.dialogue?.trim());
        setScenes(scenesWithDialogue);

        // Fetch audio assets
        if (scenesWithDialogue.length > 0) {
          const sceneIds = scenesWithDialogue.map((s: Scene) => s.id);
          const assetsResponse = await fetch(
            `/api/projects/${projectId}/assets?sceneIds=${sceneIds.join(',')}&type=audio`
          );
          if (assetsResponse.ok) {
            const assetsData: Asset[] = await assetsResponse.json();
            const grouped: Record<string, Asset[]> = {};
            assetsData.forEach((asset) => {
              if (asset.sceneId) {
                if (!grouped[asset.sceneId]) grouped[asset.sceneId] = [];
                grouped[asset.sceneId].push(asset);
              }
            });
            setAudioAssets(grouped);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVoice(sceneId: string, text: string) {
    setGeneratingSceneId(sceneId);
    try {
      const response = await fetch('/api/generate/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sceneId,
          text,
          voiceId: selectedVoice,
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成配音失败');
      }

      const data = await response.json();
      setAudioAssets((prev) => ({
        ...prev,
        [sceneId]: [...(prev[sceneId] || []), data.asset],
      }));
      toast.success('配音生成成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成配音失败');
    } finally {
      setGeneratingSceneId(null);
    }
  }

  function handlePlayAudio(assetId: string, url: string) {
    // Stop current audio if playing
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
          <CardTitle className="text-white">配音生成</CardTitle>
          <CardDescription className="text-slate-400">
            为角色对白生成 AI 配音
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mic className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">请先完成剧本</h3>
            <p className="text-slate-400 max-w-md">
              完成剧本后，可以为角色对白生成配音
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
          <CardTitle className="text-white">配音生成</CardTitle>
          <CardDescription className="text-slate-400">
            为角色对白生成 AI 配音
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mic className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">暂无对白</h3>
            <p className="text-slate-400 max-w-md">
              生成分镜后，系统将自动提取对白用于配音
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">配音生成</CardTitle>
              <CardDescription className="text-slate-400">
                共 {scenes.length} 段对白需要配音
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">音色:</span>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(voiceStyles).map(([id, style]) => (
                      <SelectItem key={id} value={id}>
                        {style.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Scene Cards */}
      <div className="grid gap-4">
        {scenes.map((scene) => {
          const sceneAudios = audioAssets[scene.id] || [];
          const isGenerating = generatingSceneId === scene.id;

          return (
            <Card key={scene.id} className="border-slate-700 bg-slate-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                    #{scene.orderIndex}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Dialogue Text */}
                <div className="bg-slate-900/50 rounded p-3">
                  <p className="text-sm text-slate-300 italic">"{scene.dialogue}"</p>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={() => scene.dialogue && handleGenerateVoice(scene.id, scene.dialogue)}
                  disabled={isGenerating || !scene.dialogue}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      生成配音
                    </>
                  )}
                </Button>

                {/* Generated Audios */}
                {sceneAudios.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300">
                      已生成的配音 ({sceneAudios.length})
                    </p>
                    <div className="space-y-2">
                      {sceneAudios.map((audio) => (
                        <div
                          key={audio.id}
                          className="flex items-center gap-3 bg-slate-900/50 rounded p-2"
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePlayAudio(audio.id, audio.url)}
                            className="h-8 w-8 p-0"
                          >
                            {playingAudio === audio.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <div className="flex-1">
                            <p className="text-sm text-white">
                              {audio.metadata?.voiceId || 'default'}
                            </p>
                            {audio.metadata?.duration && (
                              <p className="text-xs text-slate-500">
                                {audio.metadata.duration.toFixed(1)}s
                              </p>
                            )}
                          </div>
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
