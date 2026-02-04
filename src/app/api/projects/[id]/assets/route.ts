import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, assets } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get assets for a project, optionally filtered by sceneIds
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const sceneIdsParam = searchParams.get('sceneIds');
    const type = searchParams.get('type');

    // Build query conditions
    const conditions = [eq(assets.projectId, projectId)];

    if (sceneIdsParam) {
      const sceneIds = sceneIdsParam.split(',').filter(Boolean);
      if (sceneIds.length > 0) {
        conditions.push(inArray(assets.sceneId, sceneIds));
      }
    }

    if (type) {
      conditions.push(eq(assets.type, type as 'image' | 'video' | 'audio' | 'music'));
    }

    const projectAssets = await db.query.assets.findMany({
      where: and(...conditions),
      orderBy: (assets, { desc }) => [desc(assets.createdAt)],
    });

    return NextResponse.json(projectAssets);
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json({ error: '获取素材失败' }, { status: 500 });
  }
}
