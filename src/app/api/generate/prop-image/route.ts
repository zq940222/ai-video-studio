import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { props, assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserApiKey } from '@/lib/api-keys';
import { buildImageWorkflow, executeWorkflow } from '@/lib/comfyui/workflows';
import { uploadFromUrl, generateObjectName } from '@/lib/storage';

// POST - Generate prop image using ComfyUI
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { projectId, propId, propName, prompt } = await request.json();

    if (!projectId || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // Get ComfyUI endpoint
    const comfyuiUrl = await getUserApiKey(session.user.id, 'comfyui');
    if (!comfyuiUrl) {
      return NextResponse.json(
        { error: '请先配置 ComfyUI 服务地址' },
        { status: 400 }
      );
    }

    // Build workflow - use 1:1 aspect ratio for props
    const workflow = buildImageWorkflow({
      prompt,
      negativePrompt: 'low quality, blurry, distorted, watermark, text, logo, multiple objects',
      width: 1024,
      height: 1024,
      filenamePrefix: 'prop',
    });

    // Execute workflow
    const result = await executeWorkflow(comfyuiUrl, workflow, 120000);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Persist image to MinIO storage
    const objectName = generateObjectName(`props/${projectId}`, 'png');
    let persistedUrl: string;

    try {
      persistedUrl = await uploadFromUrl(result.imageUrl, objectName, 'image/png');
      console.log(`[Prop] Persisted image to: ${persistedUrl}`);
    } catch (storageError) {
      console.error('[Prop] Failed to persist to MinIO, using ComfyUI URL:', storageError);
      persistedUrl = result.imageUrl;
    }

    // Save to database if propId is provided
    if (propId) {
      await db
        .update(props)
        .set({
          generatedImageUrl: persistedUrl,
          prompt,
          updatedAt: new Date(),
        })
        .where(eq(props.id, propId));
    }

    // Also save as asset
    await db.insert(assets).values({
      projectId,
      type: 'image',
      source: 'generated',
      provider: 'comfyui',
      prompt,
      url: persistedUrl,
    });

    return NextResponse.json({
      url: persistedUrl,
      promptId: result.promptId,
      propName,
    });
  } catch (error) {
    console.error('Failed to generate prop image:', error);
    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}
