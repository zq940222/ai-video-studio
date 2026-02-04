import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scenes, assets, aiTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAvailableVideoProvider } from '@/lib/providers/video';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const {
      projectId,
      sceneId,
      assetId, // Source image asset ID for image-to-video
      prompt,
      aspectRatio,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
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

    // Get video provider
    const videoResult = await getAvailableVideoProvider(session.user.id);
    if (!videoResult) {
      return NextResponse.json(
        { error: '视频生成服务不可用，请检查 ComfyUI 配置' },
        { status: 400 }
      );
    }

    const { provider, providerId } = videoResult;

    // Prepare input
    let imageUrl: string | undefined;

    // If assetId is provided, get the image URL for image-to-video
    if (assetId) {
      const sourceAsset = await db.query.assets.findFirst({
        where: and(eq(assets.id, assetId), eq(assets.projectId, projectId)),
      });

      if (!sourceAsset) {
        return NextResponse.json({ error: '源素材不存在' }, { status: 404 });
      }

      if (sourceAsset.type !== 'image') {
        return NextResponse.json({ error: '源素材必须是图片' }, { status: 400 });
      }

      imageUrl = sourceAsset.url;
    }

    // Create AI task record
    const [task] = await db
      .insert(aiTasks)
      .values({
        projectId,
        provider: providerId,
        type: imageUrl ? 'image-to-video' : 'text-to-video',
        status: 'processing',
        input: {
          prompt,
          image: imageUrl,
          aspectRatio,
          sceneId,
        },
      })
      .returning();

    // Generate video (this may take a while)
    try {
      const result = await provider.generate({
        prompt,
        image: imageUrl,
        aspectRatio: aspectRatio || '16:9',
      });

      // Save asset to database
      const [newAsset] = await db
        .insert(assets)
        .values({
          projectId,
          sceneId: sceneId || null,
          type: 'video',
          source: 'generated',
          provider: providerId,
          prompt,
          url: result.url,
          metadata: {
            width: result.width,
            height: result.height,
            duration: result.duration,
            sourceAssetId: assetId,
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
        video: result,
        provider: providerId,
        taskId: task.id,
      });
    } catch (error) {
      // Update task status to failed
      await db
        .update(aiTasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : '视频生成失败',
          completedAt: new Date(),
        })
        .where(eq(aiTasks.id, task.id));

      throw error;
    }
  } catch (error) {
    console.error('Failed to generate video:', error);
    const message = error instanceof Error ? error.message : '生成视频失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Check video generation task status
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少任务 ID' }, { status: 400 });
    }

    const task = await db.query.aiTasks.findFirst({
      where: eq(aiTasks.id, taskId),
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, task.projectId),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!project) {
      return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
    }

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      output: task.output,
      error: task.error,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });
  } catch (error) {
    console.error('Failed to check task status:', error);
    return NextResponse.json({ error: '查询任务状态失败' }, { status: 500 });
  }
}
