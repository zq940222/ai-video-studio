import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { characters, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Get a specific character
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: projectId, characterId } = await params;

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

    const character = await db.query.characters.findFirst({
      where: and(
        eq(characters.id, characterId),
        eq(characters.projectId, projectId)
      ),
    });

    if (!character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    return NextResponse.json(character);
  } catch (error) {
    console.error('Failed to get character:', error);
    return NextResponse.json({ error: '获取角色失败' }, { status: 500 });
  }
}

// PATCH - Update a character
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: projectId, characterId } = await params;

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

    const body = await request.json();
    const { name, description, role, gender, ageGroup, prompt, referenceImageUrl, characterSheetUrl, voiceId } = body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (role !== undefined) updateData.role = role;
    if (gender !== undefined) updateData.gender = gender;
    if (ageGroup !== undefined) updateData.ageGroup = ageGroup;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (referenceImageUrl !== undefined) updateData.referenceImageUrl = referenceImageUrl;
    if (characterSheetUrl !== undefined) updateData.characterSheetUrl = characterSheetUrl;
    if (voiceId !== undefined) updateData.voiceId = voiceId;

    await db
      .update(characters)
      .set(updateData)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.projectId, projectId)
        )
      );

    return NextResponse.json({ message: '角色已更新' });
  } catch (error) {
    console.error('Failed to update character:', error);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

// DELETE - Delete a character
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: projectId, characterId } = await params;

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

    await db
      .delete(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.projectId, projectId)
        )
      );

    return NextResponse.json({ message: '角色已删除' });
  } catch (error) {
    console.error('Failed to delete character:', error);
    return NextResponse.json({ error: '删除角色失败' }, { status: 500 });
  }
}
