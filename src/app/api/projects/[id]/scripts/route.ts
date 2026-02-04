import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all scripts for a project
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const projectScripts = await db.query.scripts.findMany({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    return NextResponse.json(projectScripts);
  } catch (error) {
    console.error('Failed to fetch scripts:', error);
    return NextResponse.json({ error: '获取剧本失败' }, { status: 500 });
  }
}

// POST - Create a new script
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: '剧本内容不能为空' }, { status: 400 });
    }

    // Get the latest version number
    const latestScript = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    const newVersion = (latestScript?.version || 0) + 1;

    const [newScript] = await db
      .insert(scripts)
      .values({
        projectId,
        content: content.trim(),
        version: newVersion,
      })
      .returning();

    // Update project status to in_progress
    await db
      .update(projects)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json(newScript, { status: 201 });
  } catch (error) {
    console.error('Failed to create script:', error);
    return NextResponse.json({ error: '创建剧本失败' }, { status: 500 });
  }
}
