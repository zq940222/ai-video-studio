'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  Sparkles,
  ImageIcon,
  Pencil,
  Check,
  X,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';

interface Character {
  id?: string;
  name: string;
  description: string;
  role?: string;
  prompt?: string;
  referenceImageUrl?: string;
  characterSheetUrl?: string;
}

interface CharacterCardProps {
  character: Character;
  projectId: string;
  onUpdate?: (character: Character) => void;
  onDelete?: () => void;
}

export function CharacterCard({ character, projectId, onUpdate, onDelete }: CharacterCardProps) {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editName, setEditName] = useState(character.name);
  const [editDescription, setEditDescription] = useState(character.description);
  const [editRole, setEditRole] = useState(character.role || '');
  const [prompt, setPrompt] = useState(character.prompt || '');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [characterSheet, setCharacterSheet] = useState(character.characterSheetUrl);
  const [referenceImage, setReferenceImage] = useState(character.referenceImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate default prompt from character description
  const generateDefaultPrompt = () => {
    const basePrompt = `character portrait, ${editName}, ${editDescription}, high quality, detailed, professional lighting, neutral background`;
    setPrompt(basePrompt);
  };

  // Save info changes
  const handleSaveInfo = () => {
    onUpdate?.({
      ...character,
      name: editName,
      description: editDescription,
      role: editRole,
    });
    setIsEditingInfo(false);
    toast.success('角色信息已更新');
  };

  // Cancel info editing
  const handleCancelInfo = () => {
    setEditName(character.name);
    setEditDescription(character.description);
    setEditRole(character.role || '');
    setIsEditingInfo(false);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('characterName', character.name);
      formData.append('type', 'reference');

      const response = await fetch('/api/upload/character-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '上传失败');
      }

      const data = await response.json();
      setReferenceImage(data.url);
      toast.success('参考图已上传');
      onUpdate?.({ ...character, referenceImageUrl: data.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Generate character image using ComfyUI
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请先填写提示词');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate/character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          characterId: character.id,
          characterName: character.name,
          prompt,
          referenceImageUrl: referenceImage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '生成失败');
      }

      const data = await response.json();
      setCharacterSheet(data.url);
      toast.success('角色图已生成');
      onUpdate?.({ ...character, characterSheetUrl: data.url, prompt });
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  // Save prompt
  const handleSavePrompt = () => {
    setIsEditingPrompt(false);
    toast.success('提示词已保存');
    onUpdate?.({ ...character, prompt });
  };

  // Handle delete
  const handleDelete = () => {
    if (confirm(`确定要删除角色「${character.name}」吗？`)) {
      onDelete?.();
      toast.success('角色已删除');
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditingInfo ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="角色名称"
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="角色描述"
                  rows={2}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
                />
                <Input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="角色类型（主角/配角/路人）"
                  className="bg-slate-800 border-slate-600 text-white text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveInfo}>
                    <Check className="h-3 w-3 mr-1" />
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelInfo}>
                    <X className="h-3 w-3 mr-1" />
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-400" />
                  {character.name}
                  {editRole && (
                    <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded">
                      {editRole}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {character.description}
                </CardDescription>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {!isEditingInfo && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingInfo(true)}
                  className="text-slate-400 hover:text-white h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Character Image Display */}
        <div className="grid grid-cols-2 gap-4">
          {/* Reference Image */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm">参考图</Label>
            <div
              className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800/50 cursor-pointer hover:border-slate-600 transition-colors overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : referenceImage ? (
                <img
                  src={referenceImage}
                  alt="参考图"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Upload className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500">点击上传参考图</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Generated Image */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm">角色图</Label>
            <div className="aspect-square rounded-lg border border-slate-700 flex items-center justify-center bg-slate-800/50 overflow-hidden">
              {generating ? (
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">生成中...</p>
                </div>
              ) : characterSheet ? (
                <img
                  src={characterSheet}
                  alt="角色图"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-xs text-slate-500">点击下方按钮生成</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm">生成提示词</Label>
            {!isEditingPrompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!prompt) generateDefaultPrompt();
                  setIsEditingPrompt(true);
                }}
                className="text-slate-400 hover:text-white h-6 px-2"
              >
                <Pencil className="h-3 w-3 mr-1" />
                编辑
              </Button>
            )}
          </div>
          {isEditingPrompt ? (
            <div className="space-y-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入角色图生成提示词..."
                rows={3}
                className="bg-slate-900/50 border-slate-600 text-white text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateDefaultPrompt}
                  className="border-slate-600 text-slate-300"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  自动生成
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPrompt(character.prompt || '');
                    setIsEditingPrompt(false);
                  }}
                  className="text-slate-400"
                >
                  <X className="h-3 w-3 mr-1" />
                  取消
                </Button>
                <Button size="sm" onClick={handleSavePrompt}>
                  <Check className="h-3 w-3 mr-1" />
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-800/50 p-2 rounded">
              {prompt || '点击编辑按钮添加提示词'}
            </p>
          )}
        </div>

        {/* Generate Button */}
        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {characterSheet ? '重新生成角色图' : '生成角色图'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
