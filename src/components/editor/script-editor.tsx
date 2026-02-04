'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Sparkles, Save, FileText, Users, Film } from 'lucide-react';

interface ScriptData {
  title?: string;
  synopsis?: string;
  characters?: Array<{
    name: string;
    description: string;
  }>;
  scenes?: Array<{
    sceneNumber: number;
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
  }>;
  raw?: string;
}

interface Script {
  id: string;
  content: string;
  scriptContent: string | null;
  version: number;
  createdAt: Date;
}

interface ScriptEditorProps {
  projectId: string;
  initialScript?: Script | null;
  onScriptGenerated?: (script: Script, data: ScriptData) => void;
}

export function ScriptEditor({ projectId, initialScript, onScriptGenerated }: ScriptEditorProps) {
  const [content, setContent] = useState(initialScript?.content || '');
  const [scriptData, setScriptData] = useState<ScriptData | null>(
    initialScript?.scriptContent ? JSON.parse(initialScript.scriptContent) : null
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(scriptData ? 'preview' : 'input');

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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="input" className="data-[state=active]:bg-slate-700">
              <FileText className="h-4 w-4 mr-2" />
              输入
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-slate-700" disabled={!scriptData}>
              <Film className="h-4 w-4 mr-2" />
              剧本
            </TabsTrigger>
            <TabsTrigger value="characters" className="data-[state=active]:bg-slate-700" disabled={!scriptData?.characters}>
              <Users className="h-4 w-4 mr-2" />
              角色
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
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
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating || !content.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI 生成剧本
                </>
              )}
            </Button>
          </div>
        </div>

        <TabsContent value="input" className="mt-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-white">故事内容</CardTitle>
              <CardDescription className="text-slate-400">
                输入您的故事、小说或创意，AI 将帮您转换为专业剧本格式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在这里输入您的故事内容...&#10;&#10;例如：&#10;小明是一个普通的上班族，每天过着两点一线的生活。直到有一天，他在地铁上遇到了一个神秘的老人，给了他一本古老的日记..."
                rows={16}
                className="w-full rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                已输入 {content.length} 字符
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {scriptData && (
            <div className="space-y-4">
              {/* Title and Synopsis */}
              {(scriptData.title || scriptData.synopsis) && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-white">{scriptData.title || '剧本'}</CardTitle>
                    {scriptData.synopsis && (
                      <CardDescription className="text-slate-400">
                        {scriptData.synopsis}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              )}

              {/* Scenes */}
              {scriptData.scenes?.map((scene, index) => (
                <Card key={index} className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                        场景 {scene.sceneNumber}
                      </span>
                      {scene.location}
                      <span className="text-slate-500 text-sm font-normal">
                        - {scene.timeOfDay}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {scene.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Actions */}
                    {scene.actions && scene.actions.length > 0 && (
                      <div className="text-sm text-slate-300 italic">
                        {scene.actions.map((action, i) => (
                          <p key={i}>（{action}）</p>
                        ))}
                      </div>
                    )}

                    {/* Dialogues */}
                    {scene.dialogues?.map((dialogue, i) => (
                      <div key={i} className="border-l-2 border-blue-500 pl-4">
                        <p className="text-sm font-medium text-blue-400">
                          {dialogue.character}
                          {dialogue.direction && (
                            <span className="text-slate-500 font-normal">
                              {' '}（{dialogue.direction}）
                            </span>
                          )}
                        </p>
                        <p className="text-white">{dialogue.line}</p>
                      </div>
                    ))}

                    {/* Camera Hints */}
                    {scene.cameraHints && scene.cameraHints.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {scene.cameraHints.map((hint, i) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded"
                          >
                            {hint}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Raw content fallback */}
              {scriptData.raw && !scriptData.scenes && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="pt-6">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                      {scriptData.raw}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          {scriptData?.characters && (
            <div className="grid gap-4 md:grid-cols-2">
              {scriptData.characters.map((character, index) => (
                <Card key={index} className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-white">{character.name}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {character.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
