'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  MessageSquare,
  Camera,
  Move,
} from 'lucide-react';

interface Dialogue {
  character: string;
  line: string;
  direction?: string;
}

interface Scene {
  sceneNumber: number;
  episodeNumber?: number;
  location: string;
  timeOfDay: string;
  description: string;
  actions: string[];
  dialogues: Dialogue[];
  cameraHints?: string[];
  props?: string[];
}

interface SceneCardProps {
  scene: Scene;
  onUpdate: (scene: Scene) => void;
  onDelete: () => void;
}

export function SceneCard({ scene, onUpdate, onDelete }: SceneCardProps) {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editLocation, setEditLocation] = useState(scene.location);
  const [editTimeOfDay, setEditTimeOfDay] = useState(scene.timeOfDay);
  const [editDescription, setEditDescription] = useState(scene.description);

  // Dialogue editing
  const [editingDialogueIndex, setEditingDialogueIndex] = useState<number | null>(null);
  const [editDialogue, setEditDialogue] = useState<Dialogue>({ character: '', line: '', direction: '' });
  const [isAddingDialogue, setIsAddingDialogue] = useState(false);

  // Action editing
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [editAction, setEditAction] = useState('');
  const [isAddingAction, setIsAddingAction] = useState(false);

  // Camera hint editing
  const [editingHintIndex, setEditingHintIndex] = useState<number | null>(null);
  const [editHint, setEditHint] = useState('');
  const [isAddingHint, setIsAddingHint] = useState(false);

  // Save scene info
  const handleSaveInfo = () => {
    onUpdate({
      ...scene,
      location: editLocation,
      timeOfDay: editTimeOfDay,
      description: editDescription,
    });
    setIsEditingInfo(false);
    toast.success('场景信息已更新');
  };

  const handleCancelInfo = () => {
    setEditLocation(scene.location);
    setEditTimeOfDay(scene.timeOfDay);
    setEditDescription(scene.description);
    setIsEditingInfo(false);
  };

  // Delete scene
  const handleDelete = () => {
    if (confirm(`确定要删除场景 ${scene.sceneNumber} 吗？`)) {
      onDelete();
      toast.success('场景已删除');
    }
  };

  // Dialogue handlers
  const startEditDialogue = (index: number) => {
    setEditDialogue({ ...scene.dialogues[index] });
    setEditingDialogueIndex(index);
  };

  const saveDialogue = () => {
    if (!editDialogue.character.trim() || !editDialogue.line.trim()) {
      toast.error('请填写角色和台词');
      return;
    }
    const newDialogues = [...scene.dialogues];
    if (editingDialogueIndex !== null) {
      newDialogues[editingDialogueIndex] = editDialogue;
    }
    onUpdate({ ...scene, dialogues: newDialogues });
    setEditingDialogueIndex(null);
    toast.success('台词已更新');
  };

  const addDialogue = () => {
    if (!editDialogue.character.trim() || !editDialogue.line.trim()) {
      toast.error('请填写角色和台词');
      return;
    }
    const newDialogues = [...scene.dialogues, editDialogue];
    onUpdate({ ...scene, dialogues: newDialogues });
    setEditDialogue({ character: '', line: '', direction: '' });
    setIsAddingDialogue(false);
    toast.success('台词已添加');
  };

  const deleteDialogue = (index: number) => {
    const newDialogues = scene.dialogues.filter((_, i) => i !== index);
    onUpdate({ ...scene, dialogues: newDialogues });
    toast.success('台词已删除');
  };

  // Action handlers
  const startEditAction = (index: number) => {
    setEditAction(scene.actions[index]);
    setEditingActionIndex(index);
  };

  const saveAction = () => {
    if (!editAction.trim()) {
      toast.error('请填写动作描述');
      return;
    }
    const newActions = [...scene.actions];
    if (editingActionIndex !== null) {
      newActions[editingActionIndex] = editAction;
    }
    onUpdate({ ...scene, actions: newActions });
    setEditingActionIndex(null);
    toast.success('动作已更新');
  };

  const addAction = () => {
    if (!editAction.trim()) {
      toast.error('请填写动作描述');
      return;
    }
    const newActions = [...scene.actions, editAction];
    onUpdate({ ...scene, actions: newActions });
    setEditAction('');
    setIsAddingAction(false);
    toast.success('动作已添加');
  };

  const deleteAction = (index: number) => {
    const newActions = scene.actions.filter((_, i) => i !== index);
    onUpdate({ ...scene, actions: newActions });
    toast.success('动作已删除');
  };

  // Camera hint handlers
  const startEditHint = (index: number) => {
    setEditHint(scene.cameraHints?.[index] || '');
    setEditingHintIndex(index);
  };

  const saveHint = () => {
    if (!editHint.trim()) {
      toast.error('请填写镜头提示');
      return;
    }
    const newHints = [...(scene.cameraHints || [])];
    if (editingHintIndex !== null) {
      newHints[editingHintIndex] = editHint;
    }
    onUpdate({ ...scene, cameraHints: newHints });
    setEditingHintIndex(null);
    toast.success('镜头提示已更新');
  };

  const addHint = () => {
    if (!editHint.trim()) {
      toast.error('请填写镜头提示');
      return;
    }
    const newHints = [...(scene.cameraHints || []), editHint];
    onUpdate({ ...scene, cameraHints: newHints });
    setEditHint('');
    setIsAddingHint(false);
    toast.success('镜头提示已添加');
  };

  const deleteHint = (index: number) => {
    const newHints = (scene.cameraHints || []).filter((_, i) => i !== index);
    onUpdate({ ...scene, cameraHints: newHints });
    toast.success('镜头提示已删除');
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditingInfo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                    场景 {scene.sceneNumber}
                  </span>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="场景地点"
                    className="bg-slate-800 border-slate-600 text-white flex-1"
                  />
                  <Input
                    value={editTimeOfDay}
                    onChange={(e) => setEditTimeOfDay(e.target.value)}
                    placeholder="时间"
                    className="bg-slate-800 border-slate-600 text-white w-24"
                  />
                </div>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="场景描述"
                  rows={2}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
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
              </>
            )}
          </div>
          {!isEditingInfo && (
            <div className="flex items-center gap-1 ml-2">
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
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm flex items-center gap-1">
              <Move className="h-3 w-3" />
              动作
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditAction('');
                setIsAddingAction(true);
              }}
              className="text-slate-400 hover:text-white h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              添加
            </Button>
          </div>

          {scene.actions && scene.actions.length > 0 && (
            <div className="space-y-2">
              {scene.actions.map((action, i) => (
                <div key={i} className="group flex items-start gap-2">
                  {editingActionIndex === i ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                      />
                      <Button size="sm" onClick={saveAction} className="h-8">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingActionIndex(null)} className="h-8">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 text-sm text-slate-300 italic">（{action}）</p>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditAction(i)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAction(i)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAddingAction && (
            <div className="flex gap-2">
              <Input
                value={editAction}
                onChange={(e) => setEditAction(e.target.value)}
                placeholder="输入动作描述..."
                className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                autoFocus
              />
              <Button size="sm" onClick={addAction} className="h-8">
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingAction(false)} className="h-8">
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Dialogues Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              台词
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditDialogue({ character: '', line: '', direction: '' });
                setIsAddingDialogue(true);
              }}
              className="text-slate-400 hover:text-white h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              添加
            </Button>
          </div>

          {scene.dialogues?.map((dialogue, i) => (
            <div key={i} className="group">
              {editingDialogueIndex === i ? (
                <div className="space-y-2 p-2 bg-slate-800/50 rounded">
                  <div className="flex gap-2">
                    <Input
                      value={editDialogue.character}
                      onChange={(e) => setEditDialogue({ ...editDialogue, character: e.target.value })}
                      placeholder="角色名"
                      className="bg-slate-800 border-slate-600 text-white text-sm w-32"
                    />
                    <Input
                      value={editDialogue.direction || ''}
                      onChange={(e) => setEditDialogue({ ...editDialogue, direction: e.target.value })}
                      placeholder="表演指导（可选）"
                      className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                    />
                  </div>
                  <Textarea
                    value={editDialogue.line}
                    onChange={(e) => setEditDialogue({ ...editDialogue, line: e.target.value })}
                    placeholder="台词内容"
                    rows={2}
                    className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDialogue}>
                      <Check className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDialogueIndex(null)}>
                      <X className="h-3 w-3 mr-1" />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-l-2 border-blue-500 pl-4 flex items-start justify-between">
                  <div className="flex-1">
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
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditDialogue(i)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDialogue(i)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAddingDialogue && (
            <div className="space-y-2 p-2 bg-slate-800/50 rounded">
              <div className="flex gap-2">
                <Input
                  value={editDialogue.character}
                  onChange={(e) => setEditDialogue({ ...editDialogue, character: e.target.value })}
                  placeholder="角色名"
                  className="bg-slate-800 border-slate-600 text-white text-sm w-32"
                  autoFocus
                />
                <Input
                  value={editDialogue.direction || ''}
                  onChange={(e) => setEditDialogue({ ...editDialogue, direction: e.target.value })}
                  placeholder="表演指导（可选）"
                  className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                />
              </div>
              <Textarea
                value={editDialogue.line}
                onChange={(e) => setEditDialogue({ ...editDialogue, line: e.target.value })}
                placeholder="台词内容"
                rows={2}
                className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addDialogue}>
                  <Check className="h-3 w-3 mr-1" />
                  添加
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAddingDialogue(false)}>
                  <X className="h-3 w-3 mr-1" />
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Camera Hints */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm flex items-center gap-1">
              <Camera className="h-3 w-3" />
              镜头提示
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditHint('');
                setIsAddingHint(true);
              }}
              className="text-slate-400 hover:text-white h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              添加
            </Button>
          </div>

          {scene.cameraHints && scene.cameraHints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {scene.cameraHints.map((hint, i) => (
                <div key={i} className="group relative">
                  {editingHintIndex === i ? (
                    <div className="flex gap-1">
                      <Input
                        value={editHint}
                        onChange={(e) => setEditHint(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white text-xs h-7 w-32"
                        autoFocus
                      />
                      <Button size="sm" onClick={saveHint} className="h-7 w-7 p-0">
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingHintIndex(null)} className="h-7 w-7 p-0">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded inline-flex items-center gap-1">
                      {hint}
                      <span className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-1">
                        <button
                          onClick={() => startEditHint(i)}
                          className="hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteHint(i)}
                          className="hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAddingHint && (
            <div className="flex gap-2">
              <Input
                value={editHint}
                onChange={(e) => setEditHint(e.target.value)}
                placeholder="输入镜头提示（如：特写、远景）..."
                className="bg-slate-800 border-slate-600 text-white text-sm flex-1"
                autoFocus
              />
              <Button size="sm" onClick={addHint} className="h-8">
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingHint(false)} className="h-8">
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
