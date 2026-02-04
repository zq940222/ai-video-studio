import Link from 'next/link';
import { Film } from 'lucide-react';

export function MainNav() {
  return (
    <div className="flex items-center space-x-6">
      <Link href="/" className="flex items-center space-x-2">
        <Film className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-white">AI 短剧工坊</span>
      </Link>
      <nav className="flex items-center space-x-4 text-sm">
        <Link
          href="/"
          className="text-slate-300 hover:text-white transition-colors"
        >
          我的项目
        </Link>
        <Link
          href="/project/new"
          className="text-slate-300 hover:text-white transition-colors"
        >
          新建项目
        </Link>
      </nav>
    </div>
  );
}
