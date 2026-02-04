'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings, LogOut, User, Key } from 'lucide-react';

interface UserNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export function UserNav({ user }: UserNavProps) {
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar className="h-8 w-8 border border-slate-700 hover:border-slate-600 transition-colors">
          <AvatarFallback className="bg-slate-800 text-slate-200 text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-slate-700">
        <DropdownMenuLabel className="text-slate-200">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.name || '用户'}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem asChild className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            个人中心
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-slate-300 focus:bg-slate-700 focus:text-white cursor-pointer">
          <Link href="/settings/api-keys">
            <Key className="mr-2 h-4 w-4" />
            API 密钥
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-red-400 focus:bg-slate-700 focus:text-red-300 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
