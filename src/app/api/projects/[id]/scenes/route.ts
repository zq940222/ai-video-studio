import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, scenes } from '@/lib/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all scenes for a project
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

    // Get the latest script
    const latestScript = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    if (!latestScript) {
      return NextResponse.json([]);
    }

    // Get all scenes for this script
    const projectScenes = await db.query.scenes.findMany({
      where: eq(scenes.scriptId, latestScript.id),
      orderBy: [asc(scenes.orderIndex)],
    });

    return NextResponse.json(projectScenes);
  } catch (error) {
    console.error('Failed to fetch scenes:', error);
    return NextResponse.json({ error: '获取分镜失败' }, { status: 500 });
  }
}

// POST - Create or update scenes from script data
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

    const { scriptId, scenesData } = await request.json();

    if (!scriptId || !scenesData || !Array.isArray(scenesData)) {
      return NextResponse.json({ error: '无效的分镜数据' }, { status: 400 });
    }

    // Delete existing scenes for this script
    await db.delete(scenes).where(eq(scenes.scriptId, scriptId));

    // Insert new scenes
    const newScenes = await db
      .insert(scenes)
      .values(
        scenesData.map((scene: {
          description: string;
          dialogue?: string;
          duration?: number;
          imagePrompt?: string;
        }, index: number) => ({
          scriptId,
          orderIndex: index + 1,
          description: scene.description,
          dialogue: scene.dialogue || null,
          duration: scene.duration || 5,
          imagePrompt: scene.imagePrompt || null,
        }))
      )
      .returning();

    return NextResponse.json(newScenes, { status: 201 });
  } catch (error) {
    console.error('Failed to create scenes:', error);
    return NextResponse.json({ error: '创建分镜失败' }, { status: 500 });
  }
}
