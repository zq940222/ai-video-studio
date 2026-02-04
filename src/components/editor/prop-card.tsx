'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Package,
  Trash2,
} from 'lucide-react';

interface Prop {
  id?: string;
  name: string;
  description: string;
  significance?: string;
  prompt?: string;
  referenceImageUrl?: string;
  generatedImageUrl?: string;
}

interface PropCardProps {
  prop: Prop;
  projectId: string;
  onUpdate?: (prop: Prop) => void;
  onDelete?: () => void;
}

export function PropCard({ prop, projectId, onUpdate, onDelete }: PropCardProps) {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editName, setEditName] = useState(prop.name);
  const [editDescription, setEditDescription] = useState(prop.description);
  const [editSignificance, setEditSignificance] = useState(prop.significance || '');
  const [prompt, setPrompt] = useState(prop.prompt || '');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(prop.generatedImageUrl);
  const [referenceImage, setReferenceImage] = useState(prop.referenceImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate default prompt from prop description
  const generateDefaultPrompt = () => {
    const basePrompt = `product photography, ${editName}, ${editDescription}, clean white background, studio lighting, high quality, detailed, centered composition`;
    setPrompt(basePrompt);
  };

  // Save info changes
  const handleSaveInfo = () => {
    onUpdate?.({
      ...prop,
      name: editName,
      description: editDescription,
      significance: editSignificance,
    });
    setIsEditingInfo(false);
    toast.success('物品信息已更新');
  };

  // Cancel info editing
  const handleCancelInfo = () => {
    setEditName(prop.name);
    setEditDescription(prop.description);
    setEditSignificance(prop.significance || '');
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
      formData.append('type', 'prop');
      formData.append('name', prop.name);

      const response = await fetch('/api/upload/prop-image', {
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
      onUpdate?.({ ...prop, referenceImageUrl: data.url });
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

  // Generate prop image using ComfyUI
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请先填写提示词');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate/prop-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          propId: prop.id,
          propName: prop.name,
          prompt,
          referenceImageUrl: referenceImage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '生成失败');
      }

      const data = await response.json();
      setGeneratedImage(data.url);
      toast.success('物品图已生成');
      onUpdate?.({ ...prop, generatedImageUrl: data.url, prompt });
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
    onUpdate?.({ ...prop, prompt });
  };

  // Handle delete
  const handleDelete = () => {
    if (confirm(`确定要删除物品「${prop.name}」吗？`)) {
      onDelete?.();
      toast.success('物品已删除');
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isEditingInfo ? (
              <div className="space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="物品名称"
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="物品描述"
                  rows={2}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
                />
                <Input
                  value={editSignificance}
                  onChange={(e) => setEditSignificance(e.target.value)}
                  placeholder="剧情作用（关键道具/情感象征等）"
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
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <span className="truncate">{prop.name}</span>
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-1 line-clamp-2">
                  {prop.description}
                </CardDescription>
                {prop.significance && (
                  <Badge variant="outline" className="mt-2 text-orange-400 border-orange-400/50 text-xs">
                    {prop.significance}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {!isEditingInfo && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingInfo(true)}
                  className="text-slate-400 hover:text-white h-7 w-7 p-0"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-slate-400 hover:text-red-400 h-7 w-7 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Prop Image Display */}
        <div className="grid grid-cols-2 gap-3">
          {/* Reference Image */}
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">参考图</Label>
            <div
              className="aspect-square rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800/50 cursor-pointer hover:border-slate-600 transition-colors overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : referenceImage ? (
                <img
                  src={referenceImage}
                  alt="参考图"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-2">
                  <Upload className="h-6 w-6 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs text-slate-500">上传</p>
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
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">物品图</Label>
            <div className="aspect-square rounded-lg border border-slate-700 flex items-center justify-center bg-slate-800/50 overflow-hidden">
              {generating ? (
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">生成中</p>
                </div>
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt="物品图"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-2">
                  <ImageIcon className="h-6 w-6 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs text-slate-500">待生成</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Editor */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-xs">提示词</Label>
            {!isEditingPrompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!prompt) generateDefaultPrompt();
                  setIsEditingPrompt(true);
                }}
                className="text-slate-400 hover:text-white h-5 px-1 text-xs"
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
                placeholder="输入物品图生成提示词..."
                rows={2}
                className="bg-slate-900/50 border-slate-600 text-white text-xs resize-none"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateDefaultPrompt}
                  className="border-slate-600 text-slate-300 h-6 text-xs px-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  自动
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPrompt(prop.prompt || '');
                    setIsEditingPrompt(false);
                  }}
                  className="text-slate-400 h-6 px-2"
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" onClick={handleSavePrompt} className="h-6 px-2">
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-800/50 p-1.5 rounded line-clamp-2">
              {prompt || '点击编辑添加提示词'}
            </p>
          )}
        </div>

        {/* Generate Button */}
        <Button
          className="w-full h-8 text-sm"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              {generatedImage ? '重新生成' : '生成物品图'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
