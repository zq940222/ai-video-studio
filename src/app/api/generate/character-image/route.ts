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

    // Build character sheet prompt - front, side, back views on white background (realistic style)
    const characterSheetPrompt = `character reference sheet, character turnaround, three views, front view, side view, back view, full body standing pose, pure white background, ${prompt}, same person in all views, consistent appearance, photorealistic, realistic human, real person, high quality, detailed, professional photography lighting`;

    const characterSheetNegative = 'low quality, bad anatomy, worst quality, blurry, cropped, partial body, text, watermark, logo, colored background, busy background, different people, inconsistent design, face only, portrait, close up, anime, cartoon, illustration, drawing, painting, cgi, 3d render';

    // Build workflow - use 2:1 aspect ratio for character sheet (fits 8G VRAM)
    // 832x416 is max for wan21 while maintaining 2:1 ratio
    const workflow = buildImageWorkflow({
      prompt: characterSheetPrompt,
      negativePrompt: characterSheetNegative,
      width: 832,   // Max width for 8G VRAM
      height: 416,  // 2:1 ratio for multi-view
      filenamePrefix: 'character_sheet',
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
          prompt: characterSheetPrompt,
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
      prompt: characterSheetPrompt,
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
