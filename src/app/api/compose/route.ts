import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, assets, aiTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface SceneInput {
  sceneId: string;
  videoAssetId?: string;
  audioAssetId?: string;
}

// POST - Compose final video
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const {
      projectId,
      resolution,
      format,
      musicAssetId,
      scenes: sceneInputs,
    } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }

    if (!sceneInputs || !Array.isArray(sceneInputs) || sceneInputs.length === 0) {
      return NextResponse.json({ error: '没有可合成的视频片段' }, { status: 400 });
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

    // Collect all video URLs in order
    const videoUrls: string[] = [];
    const audioUrls: string[] = [];

    for (const sceneInput of sceneInputs as SceneInput[]) {
      if (sceneInput.videoAssetId) {
        const videoAsset = await db.query.assets.findFirst({
          where: and(
            eq(assets.id, sceneInput.videoAssetId),
            eq(assets.projectId, projectId)
          ),
        });
        if (videoAsset) {
          videoUrls.push(videoAsset.url);
        }
      }

      if (sceneInput.audioAssetId) {
        const audioAsset = await db.query.assets.findFirst({
          where: and(
            eq(assets.id, sceneInput.audioAssetId),
            eq(assets.projectId, projectId)
          ),
        });
        if (audioAsset) {
          audioUrls.push(audioAsset.url);
        }
      }
    }

    // Get background music if specified
    let musicUrl: string | undefined;
    if (musicAssetId) {
      const musicAsset = await db.query.assets.findFirst({
        where: and(
          eq(assets.id, musicAssetId),
          eq(assets.projectId, projectId)
        ),
      });
      if (musicAsset) {
        musicUrl = musicAsset.url;
      }
    }

    // Create composition task
    const [task] = await db
      .insert(aiTasks)
      .values({
        projectId,
        provider: 'ffmpeg',
        type: 'compose',
        status: 'processing',
        input: {
          videoUrls,
          audioUrls,
          musicUrl,
          resolution,
          format,
        },
      })
      .returning();

    // TODO: In a real implementation, this would:
    // 1. Download all video/audio files to a temp directory
    // 2. Generate an FFmpeg command to concatenate videos
    // 3. Mix in audio tracks and background music
    // 4. Encode to the specified format and resolution
    // 5. Upload the result to storage
    // 6. Return the download URL

    // For now, simulate the composition process
    // In production, this would be an async job processed by a worker

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate a mock output URL
    const outputFilename = `${projectId}_${Date.now()}.${format}`;
    const downloadUrl = `/api/compose/download/${outputFilename}`;

    // Update task status
    await db
      .update(aiTasks)
      .set({
        status: 'completed',
        output: {
          downloadUrl,
          filename: outputFilename,
          resolution,
          format,
          videoCount: videoUrls.length,
        },
        completedAt: new Date(),
      })
      .where(eq(aiTasks.id, task.id));

    // Save the composed video as an asset
    const [composedAsset] = await db
      .insert(assets)
      .values({
        projectId,
        sceneId: null,
        type: 'video',
        source: 'generated',
        provider: 'ffmpeg',
        prompt: `Composed video: ${videoUrls.length} clips`,
        url: downloadUrl, // This would be the actual storage URL in production
        metadata: {
          resolution,
          format,
          isComposed: true,
          sourceVideoCount: videoUrls.length,
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      taskId: task.id,
      assetId: composedAsset.id,
      downloadUrl,
      filename: outputFilename,
    });
  } catch (error) {
    console.error('Failed to compose video:', error);
    const message = error instanceof Error ? error.message : '合成视频失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Check composition status
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
    });
  } catch (error) {
    console.error('Failed to check composition status:', error);
    return NextResponse.json({ error: '查询状态失败' }, { status: 500 });
  }
}
