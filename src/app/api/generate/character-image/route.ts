import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { characters, assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserApiKey } from '@/lib/api-keys';
import { buildImageWorkflow, executeWorkflow } from '@/lib/comfyui/workflows';
import { uploadFromUrl, generateObjectName } from '@/lib/storage';

// POST - Generate character image using ComfyUI
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { projectId, characterId, characterName, prompt } = await request.json();

    console.log('[Character] Request params:', { projectId, characterId, characterName, promptLength: prompt?.length });

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

    // Build character portrait prompt - front view full body, photorealistic with detailed face
    const characterPortraitPrompt = `${prompt}, front view, full body standing pose, looking at camera, studio photography, pure white background, professional lighting, photorealistic, ultra realistic, real person, high quality, 8k uhd, sharp focus, detailed face, detailed eyes, detailed facial features, clear facial expression, detailed skin texture, skin pores, natural skin, natural pose, masterpiece, best quality`;

    const characterPortraitNegative = 'low quality, bad anatomy, worst quality, blurry, cropped, partial body, missing limbs, extra limbs, text, watermark, logo, colored background, busy background, multiple people, anime, cartoon, illustration, drawing, painting, cgi, 3d render, deformed, disfigured, ugly, bad face, blurry face, distorted face, asymmetric eyes, crossed eyes, bad eyes, extra fingers, missing fingers, fused fingers';

    // Build workflow - use 2:3 aspect ratio for full body portrait (higher res for face detail)
    const workflow = buildImageWorkflow({
      prompt: characterPortraitPrompt,
      negativePrompt: characterPortraitNegative,
      width: 576,   // Slightly higher resolution for better face detail
      height: 864,  // 2:3 ratio for full body
      filenamePrefix: 'character',
    });

    // Execute workflow
    const result = await executeWorkflow(comfyuiUrl, workflow, 120000);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Persist image to MinIO storage
    const objectName = generateObjectName(`characters/${projectId}`, 'png');
    let persistedUrl: string;

    try {
      persistedUrl = await uploadFromUrl(result.imageUrl, objectName, 'image/png');
      console.log(`[Character] Persisted image to: ${persistedUrl}`);
    } catch (storageError) {
      console.error('[Character] Failed to persist to MinIO, using ComfyUI URL:', storageError);
      // Fallback to ComfyUI URL if MinIO fails
      persistedUrl = result.imageUrl;
    }

    // Save to database if characterId is provided
    if (characterId) {
      console.log('[Character] Updating character in DB:', { characterId, persistedUrl });
      const updateResult = await db
        .update(characters)
        .set({
          characterSheetUrl: persistedUrl,
          prompt: characterPortraitPrompt,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId))
        .returning();
      console.log('[Character] DB update result:', updateResult);
    } else {
      console.log('[Character] No characterId provided, skipping character update');
    }

    // Also save as asset
    console.log('[Character] Saving asset to DB');
    const assetResult = await db.insert(assets).values({
      projectId,
      characterId: characterId || null,
      type: 'image',
      source: 'generated',
      provider: 'comfyui',
      prompt: characterPortraitPrompt,
      url: persistedUrl,
    }).returning();
    console.log('[Character] Asset saved:', assetResult[0]?.id);

    return NextResponse.json({
      url: persistedUrl,
      promptId: result.promptId,
      characterName,
    });
  } catch (error) {
    console.error('Failed to generate character image:', error);
    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}
