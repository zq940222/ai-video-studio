'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  updatedAt: Date;
}

interface ProjectCardProps {
  project: Project;
  onUpdate?: () => void;
}

export function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    if (!name.trim()) {
      toast.error('项目名称不能为空');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (response.ok) {
        toast.success('项目已更新');
        setEditDialogOpen(false);
        onUpdate?.();
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || '更新失败');
      }
    } catch {
      toast.error('更新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('项目已删除');
        setDeleteDialogOpen(false);
        onUpdate?.();
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    draft: { label: '草稿', className: 'bg-slate-800 text-slate-400' },
    in_progress: { label: '制作中', className: 'bg-blue-900/50 text-blue-400' },
    completed: { label: '已完成', className: 'bg-green-900/50 text-green-400' },
    archived: { label: '已归档', className: 'bg-yellow-900/50 text-yellow-400' },
  };

  const status = statusConfig[project.status];

  return (
    <>
      <Card className="border-slate-800 bg-slate-900/50 hover:bg-slate-800/50 transition-colors h-full group">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <Link href={`/project/${project.id}`} className="flex-1 cursor-pointer">
            <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
              {project.name}
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
              {project.description || '暂无描述'}
            </p>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuItem
                onClick={() => setEditDialogOpen(true)}
                className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-400 focus:bg-slate-700 focus:text-red-300 cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <Link href={`/project/${project.id}`}>
            <div className="flex items-center text-sm text-slate-500">
              <Clock className="mr-1 h-4 w-4" />
              {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                {status.label}
              </span>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">编辑项目</DialogTitle>
            <DialogDescription className="text-slate-400">
              修改项目的基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-slate-200">
                项目名称
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-slate-200">
                项目描述
              </Label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-slate-900/50 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              取消
            </Button>
            <Button onClick={handleEdit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">确认删除</DialogTitle>
            <DialogDescription className="text-slate-400">
              确定要删除项目「{project.name}」吗？此操作不可撤销，项目下的所有内容将被永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
