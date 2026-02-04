import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single project
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, id),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Failed to fetch project:', error);
    return NextResponse.json({ error: '获取项目失败' }, { status: 500 });
  }
}

// PATCH - Update a project
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, status } = body;

    // Verify project ownership
    const existingProject = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, id),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // Build update object
    const updateData: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (status !== undefined) {
      const validStatuses = ['draft', 'in_progress', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: '无效的项目状态' }, { status: 400 });
      }
      updateData.status = status;
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

// DELETE - Delete a project
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Verify project ownership
    const existingProject = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, id),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!existingProject) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ message: '项目已删除' });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
