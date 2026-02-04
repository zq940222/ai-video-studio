import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, scenes } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAvailableLLMProvider } from '@/lib/providers/llm';
import { STORYBOARD_SYSTEM_PROMPT, STORYBOARD_USER_PROMPT } from '@/lib/prompts/script';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { projectId, sceneIndex } = await request.json();

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

    // Get the latest script
    const latestScript = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    if (!latestScript?.scriptContent) {
      return NextResponse.json({ error: '请先生成剧本' }, { status: 400 });
    }

    // Parse script content
    let scriptData;
    try {
      scriptData = JSON.parse(latestScript.scriptContent);
    } catch {
      return NextResponse.json({ error: '剧本格式无效' }, { status: 400 });
    }

    if (!scriptData.scenes || scriptData.scenes.length === 0) {
      return NextResponse.json({ error: '剧本中没有场景' }, { status: 400 });
    }

    // Get LLM provider
    const llmResult = await getAvailableLLMProvider(session.user.id);
    if (!llmResult) {
      return NextResponse.json(
        { error: '请先配置 LLM 服务的 API Key' },
        { status: 400 }
      );
    }

    const { provider } = llmResult;

    // Generate storyboard for specific scene or all scenes
    const scenesToProcess = sceneIndex !== undefined
      ? [scriptData.scenes[sceneIndex]]
      : scriptData.scenes;

    const storyboardResults = [];

    for (const scene of scenesToProcess) {
      const result = await provider.generate({
        messages: [
          { role: 'system', content: STORYBOARD_SYSTEM_PROMPT },
          { role: 'user', content: STORYBOARD_USER_PROMPT(scene) },
        ],
        temperature: 0.7,
        maxTokens: 4096,
      });

      // Parse storyboard data
      let shots;
      try {
        let jsonStr = result.content;
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        shots = JSON.parse(jsonStr.trim());
      } catch {
        shots = [{ raw: result.content }];
      }

      storyboardResults.push({
        sceneNumber: scene.sceneNumber,
        shots,
      });
    }

    // Save scenes to database
    const scenesToInsert = storyboardResults.flatMap((result, sceneIdx) =>
      result.shots.map((shot: {
        description?: string;
        dialogue?: string;
        duration?: number;
        prompt?: string;
      }, shotIdx: number) => ({
        scriptId: latestScript.id,
        orderIndex: sceneIdx * 100 + shotIdx + 1,
        description: shot.description || '',
        dialogue: shot.dialogue || null,
        duration: shot.duration || 5,
        imagePrompt: shot.prompt || null,
      }))
    );

    // Clear existing scenes and insert new ones
    await db.delete(scenes).where(eq(scenes.scriptId, latestScript.id));

    const insertedScenes = await db
      .insert(scenes)
      .values(scenesToInsert)
      .returning();

    return NextResponse.json({
      storyboard: storyboardResults,
      scenes: insertedScenes,
    });
  } catch (error) {
    console.error('Failed to generate storyboard:', error);
    const message = error instanceof Error ? error.message : '生成分镜失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
