'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Mail, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        await update({ name });
        toast.success('个人信息已更新');
      } else {
        const data = await response.json();
        toast.error(data.error || '更新失败');
      }
    } catch {
      toast.error('更新失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">个人中心</h1>
          <p className="text-slate-400">管理您的个人信息</p>
        </div>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
          <CardDescription className="text-slate-400">
            更新您的个人资料
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              邮箱
            </Label>
            <Input
              id="email"
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="bg-slate-900/50 border-slate-600 text-slate-400"
            />
            <p className="text-xs text-slate-500">邮箱地址不可修改</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-200 flex items-center gap-2">
              <User className="h-4 w-4" />
              昵称
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="输入您的昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存修改'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
