import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, assets, aiTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAvailableMusicProvider, getMusicStyles } from '@/lib/providers/music';

// POST - Generate music
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const {
      projectId,
      prompt,
      style,
      duration,
      instrumental,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: '请提供音乐描述' }, { status: 400 });
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

    // Get music provider
    const musicResult = await getAvailableMusicProvider(session.user.id);
    if (!musicResult) {
      return NextResponse.json(
        { error: '音乐生成服务不可用，请检查 ComfyUI 配置' },
        { status: 400 }
      );
    }

    const { provider, providerId } = musicResult;

    // Create AI task record
    const [task] = await db
      .insert(aiTasks)
      .values({
        projectId,
        provider: providerId,
        type: 'music-generation',
        status: 'processing',
        input: {
          prompt,
          style,
          duration,
          instrumental,
        },
      })
      .returning();

    try {
      // Generate music
      const result = await provider.generate({
        prompt: prompt.trim(),
        style,
        duration: duration || 30,
        instrumental: instrumental !== false,
      });

      // Save asset to database
      const [newAsset] = await db
        .insert(assets)
        .values({
          projectId,
          sceneId: null, // Music is project-level, not scene-specific
          type: 'music',
          source: 'generated',
          provider: providerId,
          prompt: prompt.trim(),
          url: result.url,
          metadata: {
            duration: result.duration,
            style,
            instrumental,
          },
        })
        .returning();

      // Update task status
      await db
        .update(aiTasks)
        .set({
          status: 'completed',
          assetId: newAsset.id,
          output: result,
          completedAt: new Date(),
        })
        .where(eq(aiTasks.id, task.id));

      return NextResponse.json({
        asset: newAsset,
        music: result,
        provider: providerId,
        taskId: task.id,
      });
    } catch (error) {
      // Update task status to failed
      await db
        .update(aiTasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : '音乐生成失败',
          completedAt: new Date(),
        })
        .where(eq(aiTasks.id, task.id));

      throw error;
    }
  } catch (error) {
    console.error('Failed to generate music:', error);
    const message = error instanceof Error ? error.message : '生成音乐失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Get available music styles
export async function GET() {
  try {
    const styles = getMusicStyles();
    return NextResponse.json({ styles });
  } catch (error) {
    console.error('Failed to get music styles:', error);
    return NextResponse.json({ error: '获取音乐风格列表失败' }, { status: 500 });
  }
}
