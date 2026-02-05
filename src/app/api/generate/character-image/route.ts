import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { characters, assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserApiKey } from '@/lib/api-keys';
import { buildImageWorkflow, executeWorkflow, uploadImageToComfyUI } from '@/lib/comfyui/workflows';
import { uploadFromUrl, generateObjectName } from '@/lib/storage';
import { getAvailableLLMProvider } from '@/lib/providers/llm';

// Gender mapping for prompts - default to Chinese/Asian appearance
const GENDER_PROMPT_MAP: Record<string, string> = {
  male: '1 chinese man, asian male',
  female: '1 chinese woman, asian female',
};

// Age group mapping for prompts
const AGE_PROMPT_MAP: Record<string, string> = {
  child: 'chinese child, young kid, 8-12 years old',
  teenager: 'chinese teenager, adolescent, 15-18 years old',
  young_adult: 'chinese young adult, 25-30 years old',
  middle_aged: 'chinese middle-aged, mature, 40-50 years old',
  elderly: 'chinese elderly, senior, old, 60-70 years old, gray hair',
};

/**
 * Generate optimized English prompt for character image generation
 * Uses explicit gender/age if provided, otherwise extracts from description
 */
async function generateOptimizedPrompt(
  userId: string,
  characterDescription: string,
  gender?: string,
  ageGroup?: string
): Promise<string> {
  // Build prefix from explicit gender and age if provided
  const genderPrefix = gender ? GENDER_PROMPT_MAP[gender] : '';
  const agePrefix = ageGroup ? AGE_PROMPT_MAP[ageGroup] : '';

  try {
    const llmResult = await getAvailableLLMProvider(userId);
    if (!llmResult) {
      console.warn('[Character] No LLM available, using basic translation');
      // Fallback: combine what we have
      const parts = [genderPrefix, agePrefix, characterDescription].filter(Boolean);
      return parts.join(', ');
    }

    const { provider } = llmResult;

    // If gender and age are already provided, just translate/optimize the description
    const hasExplicitAttributes = gender && ageGroup;

    const systemPrompt = hasExplicitAttributes
      ? `You are an expert at writing prompts for AI image generation.
Convert the character description into English, focusing on physical appearance and clothing.
IMPORTANT: Default to Chinese/Asian appearance unless explicitly stated otherwise.
Output ONLY the descriptive part (hair, eyes, body type, clothing, etc.), no gender or age.
Keep it concise, comma-separated tags style.
Example output: "black hair, dark brown eyes, slim figure, fair asian skin, wearing white blouse and blue jeans"`
      : `You are an expert at writing prompts for AI image generation (Stable Diffusion / FLUX).

Your task: Convert the character description into an optimized English prompt for generating a portrait photo.

CRITICAL REQUIREMENTS:
1. ETHNICITY: Default to Chinese/Asian appearance unless explicitly stated otherwise
2. GENDER: Explicitly state "1 chinese man" or "1 chinese woman" at the BEGINNING
3. Keep age description (young, middle-aged, elderly, etc.)
4. Include key physical features (hair color/style, eye color, body type, skin tone)
5. Include clothing/outfit description if mentioned
6. Output ONLY the prompt, no explanations

FORMAT: Start with gender+ethnicity, then age, then physical description, then clothing.
Example: "1 chinese woman, young adult, asian female, long black hair, dark brown eyes, slim figure, fair skin, wearing a white blouse and blue jeans"`;

    const result = await provider.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: characterDescription },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    let optimizedPrompt = result.content.trim();

    // Prepend explicit gender and age if provided
    if (hasExplicitAttributes) {
      optimizedPrompt = `${genderPrefix}, ${agePrefix}, ${optimizedPrompt}`;
    }

    console.log('[Character] Optimized prompt:', {
      original: characterDescription,
      gender,
      ageGroup,
      optimized: optimizedPrompt
    });
    return optimizedPrompt;
  } catch (error) {
    console.error('[Character] Prompt optimization failed:', error);
    // Fallback: combine what we have
    const parts = [genderPrefix, agePrefix, characterDescription].filter(Boolean);
    return parts.join(', ');
  }
}

// POST - Generate character image using ComfyUI
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { projectId, characterId, characterName, prompt, gender, ageGroup, referenceImageUrl } = await request.json();

    console.log('[Character] Request params:', {
      projectId,
      characterId,
      characterName,
      promptLength: prompt?.length,
      hasReference: !!referenceImageUrl
    });

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

    // Generate optimized English prompt with correct gender and attributes
    const optimizedPrompt = await generateOptimizedPrompt(session.user.id, prompt, gender, ageGroup);

    // Build character portrait prompt - FLUX prefers natural language descriptions
    // Default to Chinese/Asian appearance for domestic users
    const characterPortraitPrompt = `professional studio photograph of ${optimizedPrompt}, chinese asian ethnicity, full body shot from head to toe, standing straight facing the camera directly, arms relaxed at sides, looking directly at the camera, centered in frame, plain white studio background, soft professional studio lighting, sharp focus, highly detailed face and eyes, natural asian skin texture, 8k high quality photo`;

    const characterPortraitNegative = 'western, caucasian, european, african, anime, cartoon, illustration, drawing, painting, 3d render, cgi, low quality, blurry, cropped, partial body, missing limbs, extra limbs, deformed, bad anatomy, bad hands, side view, back view, profile, sitting, lying down';

    // If reference image provided, upload to ComfyUI for img2img
    let referenceImageName: string | undefined;
    if (referenceImageUrl) {
      try {
        console.log('[Character] Uploading reference image to ComfyUI:', referenceImageUrl);
        referenceImageName = await uploadImageToComfyUI(comfyuiUrl, referenceImageUrl);
        console.log('[Character] Reference image uploaded as:', referenceImageName);
      } catch (uploadError) {
        console.error('[Character] Failed to upload reference image:', uploadError);
        // Continue without reference image if upload fails
      }
    }

    // Build workflow - use 2:3 aspect ratio for full body portrait
    // SD 1.5 optimal: 512x768, SDXL/FLUX can use higher
    // If reference image provided and uploaded, use img2img for better likeness
    const workflow = buildImageWorkflow({
      prompt: characterPortraitPrompt,
      negativePrompt: characterPortraitNegative,
      width: 512,
      height: 768,
      filenamePrefix: 'character',
      referenceImageUrl: referenceImageName ? referenceImageUrl : undefined,
      referenceImageName: referenceImageName,
      denoise: referenceImageName ? 0.55 : undefined,  // Lower denoise = more like reference (0.5-0.65 recommended)
    });

    // Execute workflow
    // FLUX GGUF on 8G VRAM can be slow, allow 5 minutes
    const result = await executeWorkflow(comfyuiUrl, workflow, 300000);

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
        .returning({ id: characters.id });
      console.log('[Character] DB update result:', updateResult.length > 0 ? 'success' : 'no rows updated');
    } else {
      console.warn('[Character] No characterId provided - image will NOT be saved to character record!');
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
