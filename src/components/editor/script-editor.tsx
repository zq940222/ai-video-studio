'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Sparkles, Save, FileText, Users, Film, Upload, MapPin, Package, Layers, Plus, Pencil, Trash2, Check, X, GripVertical, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CharacterCard } from './character-card';
import { LocationCard } from './location-card';
import { PropCard } from './prop-card';
import { SceneCard } from './scene-card';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ScriptData {
  title?: string;
  synopsis?: string;
  totalEpisodes?: number;
  characters?: Array<{
    id?: string;
    name: string;
    description: string;
    role?: string;
    gender?: string;
    ageGroup?: string;
    prompt?: string;
    referenceImageUrl?: string;
    characterSheetUrl?: string;
  }>;
  locations?: Array<{
    id?: string;
    name: string;
    description: string;
    mood?: string;
    prompt?: string;
    generatedImageUrl?: string;
  }>;
  props?: Array<{
    id?: string;
    name: string;
    description: string;
    significance?: string;
    prompt?: string;
    generatedImageUrl?: string;
  }>;
  episodes?: Array<{
    episodeNumber: number;
    title: string;
    synopsis?: string;
  }>;
  // 故事大纲（分步生成用）
  outline?: Array<{
    chapter: number;
    title: string;
    summary: string;
    keyEvents: string[];
  }>;
  scenes?: Array<{
    sceneNumber: number;
    episodeNumber?: number;
    location: string;
    timeOfDay: string;
    description: string;
    actions: string[];
    dialogues: Array<{
      character: string;
      line: string;
      direction?: string;
    }>;
    cameraHints?: string[];
    props?: string[];
  }>;
  // 生成状态
  generationState?: {
    phase: 'outline' | 'scenes' | 'complete';
    currentChapter: number;
    totalChapters: number;
    scenesGenerated: number;
  };
  estimatedScenes?: number;
  raw?: string;
}

interface Script {
  id: string;
  content: string;
  scriptContent: string | null;
  title?: string | null;
  synopsis?: string | null;
  outline?: ScriptData['outline'] | null;
  generationState?: ScriptData['generationState'] | null;
  version: number;
  createdAt: Date;
}

interface DatabaseScriptData {
  script: Script | null;
  characters: Array<{
    id: string;
    name: string;
    description: string | null;
    role: string | null;
    gender: string | null;
    ageGroup: string | null;
    prompt: string | null;
    referenceImageUrl: string | null;
    characterSheetUrl: string | null;
  }>;
  locations: Array<{
    id: string;
    name: string;
    description: string | null;
    mood: string | null;
    prompt: string | null;
    generatedImageUrl: string | null;
  }>;
  props: Array<{
    id: string;
    name: string;
    description: string | null;
    significance: string | null;
    prompt: string | null;
    generatedImageUrl: string | null;
  }>;
  scenes: Array<{
    id: string;
    orderIndex: number;
    location: string | null;
    timeOfDay: string | null;
    description: string;
    actions: string[] | null;
    dialogues: Array<{ character: string; line: string; direction?: string }> | null;
    cameraHints: string[] | null;
    sceneProps: string[] | null;
  }>;
}

interface ScriptEditorProps {
  projectId: string;
  initialScript?: Script | null;
  onScriptGenerated?: (script: Script, data: ScriptData) => void;
}

interface EpisodeCardProps {
  episode: {
    episodeNumber: number;
    title: string;
    synopsis?: string;
  };
  sceneCount: number;
  onUpdate: (episode: { episodeNumber: number; title: string; synopsis?: string }) => void;
  onDelete: () => void;
}

function EpisodeCard({ episode, sceneCount, onUpdate, onDelete }: EpisodeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(episode.title);
  const [editSynopsis, setEditSynopsis] = useState(episode.synopsis || '');

  const handleSave = () => {
    onUpdate({ ...episode, title: editTitle, synopsis: editSynopsis });
    setIsEditing(false);
    toast.success('分集信息已更新');
  };

  const handleCancel = () => {
    setEditTitle(episode.title);
    setEditSynopsis(episode.synopsis || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`确定要删除「${episode.title}」吗？`)) {
      onDelete();
      toast.success('分集已删除');
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs">
                    第 {episode.episodeNumber} 集
                  </span>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="分集标题"
                    className="bg-slate-800 border-slate-600 text-white flex-1"
                  />
                </div>
                <Textarea
                  value={editSynopsis}
                  onChange={(e) => setEditSynopsis(e.target.value)}
                  placeholder="分集简介"
                  rows={2}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    <Check className="h-3 w-3 mr-1" />
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="h-3 w-3 mr-1" />
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs">
                    第 {episode.episodeNumber} 集
                  </span>
                  {episode.title}
                </CardTitle>
                {episode.synopsis && (
                  <CardDescription className="text-slate-400">
                    {episode.synopsis}
                  </CardDescription>
                )}
              </>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
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
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500">
          包含场景：{sceneCount} 个
        </p>
      </CardContent>
    </Card>
  );
}

// Scene type
type Scene = NonNullable<ScriptData['scenes']>[number];

// Sortable wrapper for SceneCard
interface SortableSceneCardProps {
  scene: Scene;
  onUpdate: (scene: Scene) => void;
  onDelete: () => void;
}

function SortableSceneCard({ scene, onUpdate, onDelete }: SortableSceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.sceneNumber.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-4 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700/50"
        title="拖拽排序"
      >
        <GripVertical className="h-5 w-5 text-slate-500 hover:text-slate-300" />
      </div>
      <div className="pl-8">
        <SceneCard
          scene={scene}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

const SUPPORTED_FILE_TYPES = ['.txt', '.md', '.text'];
const ACCEPTED_MIME_TYPES = 'text/plain,text/markdown,.txt,.md,.text';

export function ScriptEditor({ projectId, initialScript, onScriptGenerated }: ScriptEditorProps) {
  const [content, setContent] = useState(initialScript?.content || '');
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('input');
  const [isDragging, setIsDragging] = useState(false);
  const [generatingScenes, setGeneratingScenes] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(initialScript?.id || null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load script data from database
  const loadScriptDataFromDB = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/script-data`);
      if (!response.ok) {
        throw new Error('Failed to load script data');
      }
      const data: DatabaseScriptData = await response.json();

      // Debug: log loaded character data
      console.log('[ScriptEditor] Loaded characters from API:', data.characters.map(c => ({
        id: c.id,
        name: c.name,
        characterSheetUrl: c.characterSheetUrl,
      })));

      if (data.script) {
        setCurrentScriptId(data.script.id);
        setContent(data.script.content || '');

        // Convert database data to ScriptData format
        const convertedData: ScriptData = {
          title: data.script.title || undefined,
          synopsis: data.script.synopsis || undefined,
          outline: data.script.outline || undefined,
          generationState: data.script.generationState || undefined,
          characters: data.characters.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            role: c.role || undefined,
            gender: c.gender || undefined,
            ageGroup: c.ageGroup || undefined,
            prompt: c.prompt || undefined,
            referenceImageUrl: c.referenceImageUrl || undefined,
            characterSheetUrl: c.characterSheetUrl || undefined,
          })),
          locations: data.locations.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description || '',
            mood: l.mood || undefined,
            prompt: l.prompt || undefined,
            generatedImageUrl: l.generatedImageUrl || undefined,
          })),
          props: data.props.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            significance: p.significance || undefined,
            prompt: p.prompt || undefined,
            generatedImageUrl: p.generatedImageUrl || undefined,
          })),
          scenes: data.scenes.map((s, index) => ({
            sceneNumber: index + 1,
            location: s.location || '',
            timeOfDay: s.timeOfDay || '',
            description: s.description,
            actions: s.actions || [],
            dialogues: s.dialogues || [],
            cameraHints: s.cameraHints || undefined,
            props: s.sceneProps || undefined,
          })),
        };

        console.log('[ScriptEditor] Setting scriptData with characters:', convertedData.characters?.map(c => ({
          id: c.id,
          name: c.name,
          characterSheetUrl: c.characterSheetUrl,
        })));
        setScriptData(convertedData);

        // Set active tab based on available data
        if (convertedData.scenes && convertedData.scenes.length > 0) {
          setActiveTab('preview');
        } else if (convertedData.outline && convertedData.outline.length > 0) {
          setActiveTab('outline');
        } else {
          setActiveTab('input');
        }
      }
    } catch (error) {
      console.error('Failed to load script data:', error);
      // Fall back to initial script if database load fails
      if (initialScript) {
        setContent(initialScript.content || '');
        if (initialScript.scriptContent) {
          try {
            setScriptData(JSON.parse(initialScript.scriptContent));
          } catch {
            // Ignore parse error
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadScriptDataFromDB();
  }, [projectId]);

  // Drag and drop sensors for scene reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle scene drag end
  const handleSceneDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const scenes = scriptData?.scenes || [];
      const oldIndex = scenes.findIndex((s) => s.sceneNumber.toString() === active.id);
      const newIndex = scenes.findIndex((s) => s.sceneNumber.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedScenes = arrayMove(scenes, oldIndex, newIndex);
        // Renumber scenes after reordering
        const renumberedScenes = reorderedScenes.map((s, i) => ({
          ...s,
          sceneNumber: i + 1,
        }));
        setScriptData({ ...scriptData, scenes: renumberedScenes });
        toast.success('场景顺序已更新');
      }
    }
  };


  const handleFileUpload = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_FILE_TYPES.includes(ext)) {
      toast.error(`不支持的文件格式，请上传 ${SUPPORTED_FILE_TYPES.join('、')} 文件`);
      return;
    }

    try {
      const text = await file.text();
      setContent(text);
      toast.success(`已导入文件: ${file.name}`);
    } catch {
      toast.error('文件读取失败');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 生成剧本大纲（第一步）
  const handleGenerateOutline = async () => {
    if (!content.trim()) {
      toast.error('请输入故事内容');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate/script/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      setCurrentScriptId(data.script.id);
      // Reload data from database to get persisted outline, characters, locations, props
      await loadScriptDataFromDB();
      setActiveTab('outline');
      toast.success(`大纲已生成，共 ${data.scriptData.outline?.length || 0} 个章节 (${data.provider})`);
      onScriptGenerated?.(data.script, data.scriptData);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成大纲失败';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  // 生成场景（第二步，可多次调用）
  const handleGenerateScenes = async () => {
    if (!currentScriptId) {
      toast.error('请先生成剧本大纲');
      return;
    }

    setGeneratingScenes(true);
    try {
      // 获取前一个场景的上下文
      const existingScenes = scriptData?.scenes || [];
      const lastScene = existingScenes[existingScenes.length - 1];
      const previousContext = lastScene
        ? `上一个场景：${lastScene.location}，${lastScene.description}`
        : undefined;

      const response = await fetch('/api/generate/script/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId: currentScriptId,
          previousContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      if (data.complete) {
        toast.success('所有场景已生成完成！');
      } else {
        // Reload data from database to get updated scenes
        await loadScriptDataFromDB();
        const newCount = data.newScenes?.length || 0;
        toast.success(`已生成 ${newCount} 个新场景`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成场景失败';
      toast.error(message);
    } finally {
      setGeneratingScenes(false);
    }
  };

  // 兼容旧的一次性生成（用于短故事）
  const handleGenerate = async () => {
    if (!content.trim()) {
      toast.error('请输入故事内容');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      setScriptData(data.scriptData);
      setCurrentScriptId(data.script.id);
      setActiveTab('preview');
      toast.success(`剧本已生成 (${data.provider})`);
      onScriptGenerated?.(data.script, data.scriptData);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成剧本失败';
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('请输入故事内容');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存失败');
      }

      toast.success('剧本已保存');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存剧本失败';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-800 flex-wrap h-auto gap-1">
            <TabsTrigger value="input" className="data-[state=active]:bg-slate-700">
              <FileText className="h-4 w-4 mr-2" />
              输入
            </TabsTrigger>
            <TabsTrigger value="outline" className="data-[state=active]:bg-slate-700">
              <BookOpen className="h-4 w-4 mr-2" />
              大纲
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-slate-700">
              <Film className="h-4 w-4 mr-2" />
              剧本
            </TabsTrigger>
            <TabsTrigger value="characters" className="data-[state=active]:bg-slate-700">
              <Users className="h-4 w-4 mr-2" />
              角色
            </TabsTrigger>
            <TabsTrigger value="locations" className="data-[state=active]:bg-slate-700">
              <MapPin className="h-4 w-4 mr-2" />
              场景地点
            </TabsTrigger>
            <TabsTrigger value="props" className="data-[state=active]:bg-slate-700">
              <Package className="h-4 w-4 mr-2" />
              物品
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="border-slate-600 text-slate-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              保存
            </Button>
            {/* 分步生成：第一步生成大纲 */}
            <Button
              size="sm"
              onClick={handleGenerateOutline}
              disabled={generating || !content.trim()}
              variant={scriptData?.outline ? 'outline' : 'default'}
              className={scriptData?.outline ? 'border-slate-600 text-slate-300' : ''}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成大纲中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {scriptData?.outline ? '重新生成大纲' : '1. 生成大纲'}
                </>
              )}
            </Button>
            {/* 分步生成：第二步生成场景 */}
            {scriptData?.outline && scriptData.outline.length > 0 && (
              <Button
                size="sm"
                onClick={handleGenerateScenes}
                disabled={generatingScenes || scriptData?.generationState?.phase === 'complete'}
              >
                {generatingScenes ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成场景中...
                  </>
                ) : scriptData?.generationState?.phase === 'complete' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    场景已完成
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    2. 生成场景 ({scriptData?.scenes?.length || 0}/{scriptData?.estimatedScenes || '?'})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="input" className="mt-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">故事内容</CardTitle>
                  <CardDescription className="text-slate-400">
                    输入您的故事、小说或创意，AI 将帮您转换为专业剧本格式
                  </CardDescription>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_MIME_TYPES}
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-slate-600 text-slate-300"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    上传文件
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-md transition-colors ${
                  isDragging ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                }`}
              >
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-md z-10">
                    <div className="text-center">
                      <Upload className="h-10 w-10 mx-auto text-blue-400 mb-2" />
                      <p className="text-blue-400 font-medium">松开鼠标上传文件</p>
                    </div>
                  </div>
                )}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="在这里输入您的故事内容，或拖拽文件到此处上传...&#10;&#10;支持格式：.txt、.md&#10;&#10;例如：&#10;小明是一个普通的上班族，每天过着两点一线的生活。直到有一天，他在地铁上遇到了一个神秘的老人，给了他一本古老的日记..."
                  rows={16}
                  className="w-full rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                已输入 {content.length} 字符 · 支持拖拽上传 .txt、.md 文件
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 大纲 Tab */}
        <TabsContent value="outline" className="mt-4">
          <div className="space-y-4">
            {/* 标题和简介 */}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-white">{scriptData?.title || '剧本大纲'}</CardTitle>
                {scriptData?.synopsis && (
                  <CardDescription className="text-slate-400">
                    {scriptData.synopsis}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">角色数：</span>
                    <span className="text-white ml-1">{scriptData?.characters?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">场景地点：</span>
                    <span className="text-white ml-1">{scriptData?.locations?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">已生成场景：</span>
                    <span className="text-white ml-1">{scriptData?.scenes?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 章节列表 */}
            {scriptData?.outline && scriptData.outline.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  故事章节 ({scriptData.outline.length} 章)
                </h3>
                {scriptData.outline.map((chapter, index) => (
                  <Card key={index} className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                          第 {chapter.chapter} 章
                        </span>
                        {chapter.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-slate-400 text-sm mb-2">{chapter.summary}</p>
                      {chapter.keyEvents && chapter.keyEvents.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {chapter.keyEvents.map((event, i) => (
                            <span
                              key={i}
                              className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="py-8 text-center text-slate-500">
                  暂无故事大纲，请先在"输入"页面输入故事内容，然后点击"1. 生成大纲"
                </CardContent>
              </Card>
            )}

            {/* 生成进度提示 */}
            {scriptData?.generationState && (
                <Card className="border-blue-800 bg-blue-900/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-blue-300">
                        {scriptData.generationState.phase === 'outline' && (
                          <>大纲已生成，点击"生成场景"开始生成详细剧本</>
                        )}
                        {scriptData.generationState.phase === 'scenes' && (
                          <>
                            已生成 {scriptData.scenes?.length || 0} 个场景，
                            正在处理第 {scriptData.generationState.currentChapter}/{scriptData.generationState.totalChapters} 章
                          </>
                        )}
                        {scriptData.generationState.phase === 'complete' && (
                          <>全部 {scriptData.scenes?.length || 0} 个场景已生成完成！</>
                        )}
                      </div>
                      {scriptData.generationState.phase !== 'complete' && (
                        <Button
                          size="sm"
                          onClick={handleGenerateScenes}
                          disabled={generatingScenes}
                        >
                          {generatingScenes ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              继续生成场景
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="space-y-4">
            {/* Title and Synopsis - Editable */}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white">{scriptData?.title || '剧本'}</CardTitle>
                    {scriptData?.synopsis && (
                      <CardDescription className="text-slate-400">
                        {scriptData.synopsis}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextSceneNumber = (scriptData?.scenes?.length || 0) + 1;
                      const newScene = {
                        sceneNumber: nextSceneNumber,
                        location: '新场景',
                        timeOfDay: '日',
                        description: '场景描述',
                        actions: [],
                        dialogues: [],
                        cameraHints: [],
                      };
                      setScriptData({
                        ...scriptData,
                        scenes: [...(scriptData?.scenes || []), newScene],
                      });
                    }}
                    className="border-slate-600 text-slate-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加场景
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Scenes with Drag and Drop */}
            {scriptData?.scenes && scriptData.scenes.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSceneDragEnd}
                >
                  <SortableContext
                    items={scriptData.scenes.map((s) => s.sceneNumber.toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-4">
                      {scriptData.scenes.map((scene, index) => (
                        <SortableSceneCard
                          key={scene.sceneNumber}
                          scene={scene}
                          onUpdate={(updated) => {
                            const newScenes = [...(scriptData.scenes || [])];
                            newScenes[index] = updated;
                            setScriptData({ ...scriptData, scenes: newScenes });
                          }}
                          onDelete={() => {
                            const newScenes = scriptData.scenes?.filter((_, i) => i !== index) || [];
                            // Renumber scenes
                            const renumberedScenes = newScenes.map((s, i) => ({
                              ...s,
                              sceneNumber: i + 1,
                            }));
                            setScriptData({ ...scriptData, scenes: renumberedScenes });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="py-8 text-center text-slate-500">
                    暂无场景，点击上方按钮添加
                  </CardContent>
                </Card>
              )}

            {/* Raw content fallback */}
            {scriptData?.raw && !scriptData.scenes?.length && (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="pt-6">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                    {scriptData.raw}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newCharacter = { name: '新角色', description: '角色描述' };
                  setScriptData({
                    ...scriptData,
                    characters: [...(scriptData?.characters || []), newCharacter],
                  });
                }}
                className="border-slate-600 text-slate-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加角色
              </Button>
            </div>
            {scriptData?.characters && scriptData.characters.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {scriptData.characters.map((character, index) => (
                  <CharacterCard
                    key={character.id || `temp-${index}`}
                    character={character}
                    projectId={projectId}
                    onUpdate={async (updated) => {
                      // Use functional update to get latest state (avoids stale closure)
                      setScriptData(prev => {
                        const newCharacters = [...(prev.characters || [])];
                        newCharacters[index] = { ...newCharacters[index], ...updated };
                        return { ...prev, characters: newCharacters };
                      });

                      // Persist to database if character has an ID
                      if (character.id) {
                        try {
                          await fetch(`/api/projects/${projectId}/characters/${character.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updated),
                          });
                        } catch (error) {
                          console.error('[ScriptEditor] Failed to persist character update:', error);
                        }
                      }
                    }}
                    onDelete={async () => {
                      // Use functional update to get latest state
                      setScriptData(prev => ({
                        ...prev,
                        characters: prev.characters?.filter((_, i) => i !== index) || []
                      }));

                      // Delete from database if character has an ID
                      if (character.id) {
                        try {
                          await fetch(`/api/projects/${projectId}/characters/${character.id}`, {
                            method: 'DELETE',
                          });
                        } catch (error) {
                          console.error('[ScriptEditor] Failed to delete character:', error);
                        }
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="py-8 text-center text-slate-500">
                  暂无角色，点击上方按钮添加
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="episodes" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const nextEpisode = (scriptData?.episodes?.length || 0) + 1;
                  const newEpisode = { episodeNumber: nextEpisode, title: `第${nextEpisode}集`, synopsis: '' };
                  setScriptData({
                    ...scriptData,
                    episodes: [...(scriptData?.episodes || []), newEpisode],
                  });
                }}
                className="border-slate-600 text-slate-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加分集
              </Button>
            </div>
            {scriptData?.episodes && scriptData.episodes.length > 0 ? (
              <div className="space-y-4">
                {scriptData.episodes.map((episode, index) => (
                  <EpisodeCard
                    key={index}
                    episode={episode}
                    sceneCount={scriptData.scenes?.filter(s => s.episodeNumber === episode.episodeNumber).length || 0}
                    onUpdate={(updated) => {
                      const newEpisodes = [...(scriptData.episodes || [])];
                      newEpisodes[index] = { ...newEpisodes[index], ...updated };
                      setScriptData({ ...scriptData, episodes: newEpisodes });
                    }}
                    onDelete={() => {
                      const newEpisodes = scriptData.episodes?.filter((_, i) => i !== index) || [];
                      setScriptData({ ...scriptData, episodes: newEpisodes });
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="py-8 text-center text-slate-500">
                  暂无分集，点击上方按钮添加
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newLocation = { name: '新场景', description: '场景描述' };
                  setScriptData({
                    ...scriptData,
                    locations: [...(scriptData?.locations || []), newLocation],
                  });
                }}
                className="border-slate-600 text-slate-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加场景
              </Button>
            </div>
            {scriptData?.locations && scriptData.locations.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {scriptData.locations.map((location, index) => (
                  <LocationCard
                    key={index}
                    location={location}
                    projectId={projectId}
                    onUpdate={(updated) => {
                      const newLocations = [...(scriptData.locations || [])];
                      newLocations[index] = { ...newLocations[index], ...updated };
                      setScriptData({ ...scriptData, locations: newLocations });
                    }}
                    onDelete={() => {
                      const newLocations = scriptData.locations?.filter((_, i) => i !== index) || [];
                      setScriptData({ ...scriptData, locations: newLocations });
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="py-8 text-center text-slate-500">
                  暂无场景，点击上方按钮添加
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="props" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newProp = { name: '新物品', description: '物品描述' };
                  setScriptData({
                    ...scriptData,
                    props: [...(scriptData?.props || []), newProp],
                  });
                }}
                className="border-slate-600 text-slate-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                添加物品
              </Button>
            </div>
            {scriptData?.props && scriptData.props.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scriptData.props.map((prop, index) => (
                  <PropCard
                    key={index}
                    prop={prop}
                    projectId={projectId}
                    onUpdate={(updated) => {
                      const newProps = [...(scriptData.props || [])];
                      newProps[index] = { ...newProps[index], ...updated };
                      setScriptData({ ...scriptData, props: newProps });
                    }}
                    onDelete={() => {
                      const newPropsArr = scriptData.props?.filter((_, i) => i !== index) || [];
                      setScriptData({ ...scriptData, props: newPropsArr });
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="py-8 text-center text-slate-500">
                  暂无物品，点击上方按钮添加
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
