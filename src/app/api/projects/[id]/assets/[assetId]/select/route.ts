import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, assets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string; assetId: string }>;
}

// POST - Select an asset as the final choice for its scene
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, assetId } = await params;
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

    // Get the asset to find its sceneId
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.projectId, projectId)),
    });

    if (!asset) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    if (!asset.sceneId) {
      return NextResponse.json({ error: '该素材不属于任何分镜' }, { status: 400 });
    }

    // Deselect all other assets for this scene
    await db
      .update(assets)
      .set({ isSelected: false })
      .where(and(eq(assets.sceneId, asset.sceneId), eq(assets.projectId, projectId)));

    // Select this asset
    const [updatedAsset] = await db
      .update(assets)
      .set({ isSelected: true })
      .where(eq(assets.id, assetId))
      .returning();

    return NextResponse.json(updatedAsset);
  } catch (error) {
    console.error('Failed to select asset:', error);
    return NextResponse.json({ error: '选择素材失败' }, { status: 500 });
  }
}
