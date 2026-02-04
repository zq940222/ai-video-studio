import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, scenes } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string; sceneId: string }>;
}

// GET - Get a single scene
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, sceneId } = await params;
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

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
    });

    if (!scene) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    return NextResponse.json(scene);
  } catch (error) {
    console.error('Failed to fetch scene:', error);
    return NextResponse.json({ error: '获取分镜失败' }, { status: 500 });
  }
}

// PATCH - Update a scene
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, sceneId } = await params;
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

    // Get the scene to verify it belongs to this project
    const existingScene = await db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
    });

    if (!existingScene) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    // Verify the scene's script belongs to this project
    const script = await db.query.scripts.findFirst({
      where: and(
        eq(scripts.id, existingScene.scriptId),
        eq(scripts.projectId, projectId)
      ),
    });

    if (!script) {
      return NextResponse.json({ error: '无权访问此分镜' }, { status: 403 });
    }

    const body = await request.json();
    const { description, dialogue, duration, imagePrompt } = body;

    // Build update object with only provided fields
    const updateData: Partial<{
      description: string;
      dialogue: string | null;
      duration: number | null;
      imagePrompt: string | null;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (description !== undefined) updateData.description = description;
    if (dialogue !== undefined) updateData.dialogue = dialogue;
    if (duration !== undefined) updateData.duration = duration;
    if (imagePrompt !== undefined) updateData.imagePrompt = imagePrompt;

    const [updatedScene] = await db
      .update(scenes)
      .set(updateData)
      .where(eq(scenes.id, sceneId))
      .returning();

    return NextResponse.json(updatedScene);
  } catch (error) {
    console.error('Failed to update scene:', error);
    return NextResponse.json({ error: '更新分镜失败' }, { status: 500 });
  }
}

// DELETE - Delete a scene
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id: projectId, sceneId } = await params;
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

    // Get the scene
    const existingScene = await db.query.scenes.findFirst({
      where: eq(scenes.id, sceneId),
    });

    if (!existingScene) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    // Verify the scene's script belongs to this project
    const script = await db.query.scripts.findFirst({
      where: and(
        eq(scripts.id, existingScene.scriptId),
        eq(scripts.projectId, projectId)
      ),
    });

    if (!script) {
      return NextResponse.json({ error: '无权访问此分镜' }, { status: 403 });
    }

    await db.delete(scenes).where(eq(scenes.id, sceneId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scene:', error);
    return NextResponse.json({ error: '删除分镜失败' }, { status: 500 });
  }
}
