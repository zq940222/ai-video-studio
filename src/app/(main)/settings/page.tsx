'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Key, Palette, Bell, Shield } from 'lucide-react';
import Link from 'next/link';

const settingsItems = [
  {
    title: 'API 密钥',
    description: '管理 AI 服务的 API Key 和授权配置',
    icon: Key,
    href: '/settings/api-keys',
  },
  {
    title: '外观设置',
    description: '自定义界面主题和显示偏好',
    icon: Palette,
    href: '/settings/appearance',
    disabled: true,
  },
  {
    title: '通知设置',
    description: '配置邮件和系统通知',
    icon: Bell,
    href: '/settings/notifications',
    disabled: true,
  },
  {
    title: '隐私与安全',
    description: '管理账户安全和隐私选项',
    icon: Shield,
    href: '/settings/security',
    disabled: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">设置</h1>
          <p className="text-slate-400">管理您的应用设置</p>
        </div>
      </div>

      <div className="grid gap-4">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <Card
              className={`border-slate-800 bg-slate-900/50 transition-colors ${
                item.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    <Icon className="h-5 w-5 text-slate-300" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">{item.title}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm">
                      {item.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );

          if (item.disabled) {
            return (
              <div key={item.title} className="relative">
                {content}
                <span className="absolute top-3 right-3 text-xs text-slate-500">即将推出</span>
              </div>
            );
          }

          return (
            <Link key={item.title} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
