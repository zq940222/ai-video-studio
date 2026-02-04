'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入项目名称');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '创建失败');
        return;
      }

      router.push(`/project/${data.id}`);
    } catch {
      setError('创建失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回项目列表
        </Link>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">创建新项目</CardTitle>
          <CardDescription className="text-slate-400">
            开始您的 AI 短剧创作之旅
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-200">
                项目名称 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                placeholder="例如：我的第一部短剧"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-200">
                项目描述（可选）
              </Label>
              <textarea
                id="description"
                placeholder="简要描述您的短剧内容..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '创建中...' : '创建项目'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
