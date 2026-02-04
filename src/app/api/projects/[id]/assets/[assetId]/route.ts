import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, assets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string; assetId: string }>;
}

// GET - Get a single asset
export async function GET(request: Request, { params }: RouteParams) {
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

    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.projectId, projectId)),
    });

    if (!asset) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Failed to fetch asset:', error);
    return NextResponse.json({ error: '获取素材失败' }, { status: 500 });
  }
}

// DELETE - Delete an asset
export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Verify asset exists and belongs to project
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.projectId, projectId)),
    });

    if (!asset) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    // Delete the asset
    await db.delete(assets).where(eq(assets.id, assetId));

    // TODO: Also delete the file from storage (MinIO/S3)

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    return NextResponse.json({ error: '删除素材失败' }, { status: 500 });
  }
}

// PATCH - Update an asset
export async function PATCH(request: Request, { params }: RouteParams) {
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

    // Verify asset exists and belongs to project
    const asset = await db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.projectId, projectId)),
    });

    if (!asset) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { isSelected, metadata } = body;

    const updateData: Partial<{
      isSelected: boolean;
      metadata: unknown;
    }> = {};

    if (isSelected !== undefined) updateData.isSelected = isSelected;
    if (metadata !== undefined) {
      const currentMetadata = (asset.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...currentMetadata, ...metadata };
    }

    const [updatedAsset] = await db
      .update(assets)
      .set(updateData)
      .where(eq(assets.id, assetId))
      .returning();

    return NextResponse.json(updatedAsset);
  } catch (error) {
    console.error('Failed to update asset:', error);
    return NextResponse.json({ error: '更新素材失败' }, { status: 500 });
  }
}
