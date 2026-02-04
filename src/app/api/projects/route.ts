import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, session.user.id),
      orderBy: [desc(projects.updatedAt)],
    });

    return NextResponse.json(userProjects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'draft',
      })
      .returning();

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
  }
}
