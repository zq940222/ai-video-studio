'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '注册失败');
        return;
      }

      // Registration successful, redirect to login
      router.push('/login?registered=true');
    } catch {
      setError('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center text-white">
          注册
        </CardTitle>
        <CardDescription className="text-center text-slate-400">
          创建您的 AI 短剧制作平台账号
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-200">用户名（可选）</Label>
            <Input
              id="name"
              type="text"
              placeholder="您的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="至少6个字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-200">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </Button>
          <p className="text-sm text-slate-400 text-center">
            已有账号？{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 underline">
              立即登录
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
