import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Film } from 'lucide-react';
import { ProjectList } from '@/components/projects/project-list';

export default async function ProjectsPage() {
  const session = await auth();

  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, session!.user.id),
    orderBy: [desc(projects.updatedAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">我的项目</h1>
          <p className="text-slate-400">管理您的 AI 短剧制作项目</p>
        </div>
        <Button asChild>
          <Link href="/project/new">
            <Plus className="mr-2 h-4 w-4" />
            新建项目
          </Link>
        </Button>
      </div>

      {userProjects.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">还没有项目</h3>
            <p className="text-slate-400 text-center mb-6">
              创建您的第一个 AI 短剧项目，开始创作之旅
            </p>
            <Button asChild>
              <Link href="/project/new">
                <Plus className="mr-2 h-4 w-4" />
                创建第一个项目
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ProjectList projects={userProjects} />
      )}
    </div>
  );
}
