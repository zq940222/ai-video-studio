import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scenes, assets, aiTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAvailableVoiceProvider, getVoiceStyles } from '@/lib/providers/voice';

// POST - Generate voice/TTS
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const {
      projectId,
      sceneId,
      text,
      voiceId,
      speed,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }

    if (!text?.trim()) {
      return NextResponse.json({ error: '请提供配音文本' }, { status: 400 });
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

    // Get voice provider
    const voiceResult = await getAvailableVoiceProvider(session.user.id);
    if (!voiceResult) {
      return NextResponse.json(
        { error: '配音服务不可用，请检查 ComfyUI 配置' },
        { status: 400 }
      );
    }

    const { provider, providerId } = voiceResult;

    // Create AI task record
    const [task] = await db
      .insert(aiTasks)
      .values({
        projectId,
        provider: providerId,
        type: 'tts',
        status: 'processing',
        input: {
          text,
          voiceId,
          speed,
          sceneId,
        },
      })
      .returning();

    try {
      // Generate voice
      const result = await provider.generate({
        text: text.trim(),
        voiceId: voiceId || 'female-narrator',
        speed: speed || 1.0,
      });

      // Save asset to database
      const [newAsset] = await db
        .insert(assets)
        .values({
          projectId,
          sceneId: sceneId || null,
          type: 'audio',
          source: 'generated',
          provider: providerId,
          prompt: text.trim(),
          url: result.url,
          metadata: {
            duration: result.duration,
            voiceId,
            speed,
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
        audio: result,
        provider: providerId,
        taskId: task.id,
      });
    } catch (error) {
      // Update task status to failed
      await db
        .update(aiTasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : '配音生成失败',
          completedAt: new Date(),
        })
        .where(eq(aiTasks.id, task.id));

      throw error;
    }
  } catch (error) {
    console.error('Failed to generate voice:', error);
    const message = error instanceof Error ? error.message : '生成配音失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Get available voice styles
export async function GET() {
  try {
    const styles = getVoiceStyles();
    return NextResponse.json({ styles });
  } catch (error) {
    console.error('Failed to get voice styles:', error);
    return NextResponse.json({ error: '获取音色列表失败' }, { status: 500 });
  }
}
