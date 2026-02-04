import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, timelines } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get timeline for a project
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

    // Get timeline
    const timeline = await db.query.timelines.findFirst({
      where: eq(timelines.projectId, projectId),
    });

    if (!timeline) {
      return NextResponse.json({
        id: null,
        tracks: [],
        duration: 0,
      });
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Failed to fetch timeline:', error);
    return NextResponse.json({ error: '获取时间线失败' }, { status: 500 });
  }
}

// POST - Create or update timeline
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

    const { tracks, duration } = await request.json();

    // Check if timeline exists
    const existingTimeline = await db.query.timelines.findFirst({
      where: eq(timelines.projectId, projectId),
    });

    let timeline;

    if (existingTimeline) {
      // Update existing timeline
      [timeline] = await db
        .update(timelines)
        .set({
          tracks,
          duration,
          updatedAt: new Date(),
        })
        .where(eq(timelines.id, existingTimeline.id))
        .returning();
    } else {
      // Create new timeline
      [timeline] = await db
        .insert(timelines)
        .values({
          projectId,
          tracks,
          duration,
        })
        .returning();
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Failed to save timeline:', error);
    return NextResponse.json({ error: '保存时间线失败' }, { status: 500 });
  }
}

// DELETE - Delete timeline
export async function DELETE(request: Request, { params }: RouteParams) {
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

    await db.delete(timelines).where(eq(timelines.projectId, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete timeline:', error);
    return NextResponse.json({ error: '删除时间线失败' }, { status: 500 });
  }
}
