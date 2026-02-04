'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Image as ImageIcon,
  Wand2,
  Check,
  RefreshCw,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

interface StoryboardPanelProps {
  scenes: Scene[];
  assets: Record<string, Asset[]>;
  onGenerateImage: (sceneId: string, prompt: string) => Promise<Asset>;
  onSelectAsset: (sceneId: string, assetId: string) => void;
  onUpdatePrompt: (sceneId: string, newPrompt: string) => void;
  onRegenerateStoryboard: () => void;
  isRegenerating: boolean;
}

function SceneCard({
  scene,
  sceneAssets,
  onGenerateImage,
  onSelectAsset,
  onUpdatePrompt,
}: {
  scene: Scene;
  sceneAssets: Asset[];
  onGenerateImage: (sceneId: string, prompt: string) => Promise<Asset>;
  onSelectAsset: (sceneId: string, assetId: string) => void;
  onUpdatePrompt: (sceneId: string, newPrompt: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.imagePrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedAsset = sceneAssets.find((a) => a.isSelected);

  async function handleGenerate() {
    const prompt = scene.imagePrompt || scene.description;
    if (!prompt) return;

    setIsGenerating(true);
    try {
      await onGenerateImage(scene.id, prompt);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSavePrompt() {
    onUpdatePrompt(scene.id, editedPrompt);
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setEditedPrompt(scene.imagePrompt || '');
    setIsEditing(false);
  }

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                #{scene.orderIndex}
              </span>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1 line-clamp-2">
              {scene.description}
            </CardDescription>
          </div>
          {selectedAsset && (
            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 ml-4">
              <img
                src={selectedAsset.url}
                alt={`Scene ${scene.orderIndex}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Dialogue */}
          {scene.dialogue && (
            <div className="bg-slate-900/50 rounded p-3">
              <p className="text-sm text-slate-300 italic">"{scene.dialogue}"</p>
            </div>
          )}

          {/* Duration */}
          {scene.duration && (
            <p className="text-xs text-slate-500">预计时长: {scene.duration}秒</p>
          )}

          {/* Image Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">图片提示词</label>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-7 text-slate-400 hover:text-white"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  编辑
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="输入图片生成提示词..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSavePrompt}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="text-slate-400"
                  >
                    <X className="h-3 w-3 mr-1" />
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 bg-slate-900/50 rounded p-2">
                {scene.imagePrompt || scene.description || '暂无提示词'}
              </p>
            )}
          </div>

          {/* Generated Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                候选图片 ({sceneAssets.length})
              </label>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="h-7 bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    生成图片
                  </>
                )}
              </Button>
            </div>

            {sceneAssets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {sceneAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className={`relative group rounded overflow-hidden cursor-pointer border-2 transition-colors ${
                      asset.isSelected
                        ? 'border-blue-500'
                        : 'border-transparent hover:border-slate-500'
                    }`}
                    onClick={() => onSelectAsset(scene.id, asset.id)}
                  >
                    <img
                      src={asset.url}
                      alt={`Candidate ${asset.id}`}
                      className="w-full aspect-video object-cover"
                    />
                    {asset.isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs">
                        {asset.isSelected ? '已选择' : '点击选择'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded p-6 text-center">
                <ImageIcon className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">暂无候选图片</p>
                <p className="text-xs text-slate-600 mt-1">
                  点击"生成图片"按钮生成概念图
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function StoryboardPanel({
  scenes,
  assets,
  onGenerateImage,
  onSelectAsset,
  onUpdatePrompt,
  onRegenerateStoryboard,
  isRegenerating,
}: StoryboardPanelProps) {
  const totalScenes = scenes.length;
  const completedScenes = scenes.filter((s) => {
    const sceneAssets = assets[s.id] || [];
    return sceneAssets.some((a) => a.isSelected);
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">分镜设计</CardTitle>
              <CardDescription className="text-slate-400">
                共 {totalScenes} 个分镜，已完成 {completedScenes} 个
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onRegenerateStoryboard}
                disabled={isRegenerating}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    重新生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新生成分镜
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(completedScenes / totalScenes) * 100}%` }}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Scene Cards */}
      <div className="grid gap-4">
        {scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            sceneAssets={assets[scene.id] || []}
            onGenerateImage={onGenerateImage}
            onSelectAsset={onSelectAsset}
            onUpdatePrompt={onUpdatePrompt}
          />
        ))}
      </div>
    </div>
  );
}
