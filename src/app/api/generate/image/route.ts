import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scenes, assets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAvailableImageProvider } from '@/lib/providers/image';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { projectId, sceneId, prompt, negativePrompt, width, height } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ error: '请提供图片提示词' }, { status: 400 });
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

    // Get image provider
    const imageResult = await getAvailableImageProvider(session.user.id);
    if (!imageResult) {
      return NextResponse.json(
        { error: 'ComfyUI 服务不可用，请检查配置' },
        { status: 400 }
      );
    }

    const { provider, providerId } = imageResult;

    // Generate image
    const result = await provider.generate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt?.trim(),
      width: width || 1024,
      height: height || 1024,
    });

    // Save asset to database
    const [newAsset] = await db
      .insert(assets)
      .values({
        projectId,
        sceneId: sceneId || null,
        type: 'image',
        source: 'generated',
        provider: providerId,
        prompt: prompt.trim(),
        url: result.url,
        metadata: {
          width: result.width,
          height: result.height,
          negativePrompt,
        },
      })
      .returning();

    // If sceneId provided, mark this as a candidate image
    if (sceneId) {
      await db
        .update(scenes)
        .set({ updatedAt: new Date() })
        .where(eq(scenes.id, sceneId));
    }

    return NextResponse.json({
      asset: newAsset,
      image: result,
      provider: providerId,
    });
  } catch (error) {
    console.error('Failed to generate image:', error);
    const message = error instanceof Error ? error.message : '生成图片失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
