import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, scenes, characters, locations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAvailableLLMProvider } from '@/lib/providers/llm';
import { SCRIPT_SCENES_SYSTEM_PROMPT, SCRIPT_SCENES_USER_PROMPT } from '@/lib/prompts/script';
import { saveScriptScenes } from '@/lib/services/script-persistence';

/**
 * Attempt to repair truncated JSON
 */
function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/,?\s*"[^"]*":\s*"?[^"]*$/, '');
  repaired = repaired.replace(/,?\s*"[^"]*":\s*$/, '');

  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of repaired) {
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }

  if (inString) repaired += '"';
  while (bracketCount > 0) { repaired += ']'; bracketCount--; }
  while (braceCount > 0) { repaired += '}'; braceCount--; }

  return repaired;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { scriptId, previousContext } = await request.json();

    if (!scriptId) {
      return NextResponse.json({ error: '缺少剧本 ID' }, { status: 400 });
    }

    // Get the script
    const script = await db.query.scripts.findFirst({
      where: eq(scripts.id, scriptId),
    });

    if (!script) {
      return NextResponse.json({ error: '剧本不存在' }, { status: 404 });
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, script.projectId), eq(projects.userId, session.user.id)),
    });
    if (!project) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    // Use database fields for outline and generation state
    const outline = script.outline || [];
    if (outline.length === 0) {
      return NextResponse.json({ error: '请先生成剧本大纲' }, { status: 400 });
    }

    const generationState = script.generationState || {
      phase: 'scenes',
      currentChapter: 1,
      totalChapters: outline.length,
      scenesGenerated: 0,
    };

    const fromChapter = generationState.currentChapter || 1;

    // Check if all chapters are done
    if (fromChapter > outline.length) {
      return NextResponse.json({
        script,
        complete: true,
        message: '所有场景已生成完成',
      });
    }

    // Get existing scenes count from database
    const existingScenes = await db.query.scenes.findMany({
      where: eq(scenes.scriptId, scriptId),
      columns: { id: true },
    });
    const startSceneNumber = existingScenes.length + 1;

    // Load characters and locations from database
    const [projectCharacters, projectLocations] = await Promise.all([
      db.query.characters.findMany({
        where: eq(characters.projectId, script.projectId),
      }),
      db.query.locations.findMany({
        where: eq(locations.projectId, script.projectId),
      }),
    ]);

    // Get available LLM provider
    const llmResult = await getAvailableLLMProvider(session.user.id);
    if (!llmResult) {
      return NextResponse.json(
        { error: '请先配置 LLM 服务的 API Key' },
        { status: 400 }
      );
    }

    const { provider, providerId } = llmResult;

    // Generate scenes
    const result = await provider.generate({
      messages: [
        { role: 'system', content: SCRIPT_SCENES_SYSTEM_PROMPT },
        {
          role: 'user',
          content: SCRIPT_SCENES_USER_PROMPT({
            outline: {
              title: script.title || '',
              characters: projectCharacters.map((c) => ({ name: c.name, description: c.description || '', role: c.role })),
              locations: projectLocations.map((l) => ({ name: l.name, description: l.description || '', mood: l.mood })),
              outline,
            },
            fromChapter,
            startSceneNumber,
            previousContext,
          }),
        },
      ],
      temperature: 0.7,
      maxTokens: 8192,
    });

    // Parse the scenes
    let scenesResult;
    try {
      let jsonStr = result.content;
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
        }
      }

      try {
        scenesResult = JSON.parse(jsonStr.trim());
      } catch {
        console.warn('Initial JSON parse failed, attempting repair...');
        const repairedJson = repairTruncatedJson(jsonStr.trim());
        scenesResult = JSON.parse(repairedJson);
      }
    } catch (parseError) {
      console.error('Failed to parse scenes JSON:', parseError);
      return NextResponse.json(
        { error: '解析场景失败，请重试' },
        { status: 500 }
      );
    }

    const newScenes = scenesResult.scenes || [];
    const hasMore = scenesResult.hasMore !== false &&
      (scenesResult.nextChapter || fromChapter + 1) <= outline.length;

    // Save scenes to database
    await saveScriptScenes(
      scriptId,
      { scenes: newScenes, hasMore },
      fromChapter,
      outline.length
    );

    // Also update scriptContent for backward compatibility
    let existingScriptData = {};
    try {
      existingScriptData = JSON.parse(script.scriptContent || '{}');
    } catch {
      existingScriptData = {};
    }
    const updatedScriptData = {
      ...existingScriptData,
      scenes: [...(existingScriptData as { scenes?: unknown[] }).scenes || [], ...newScenes],
      generationState: {
        phase: hasMore ? 'scenes' : 'complete',
        currentChapter: hasMore ? (scenesResult.nextChapter || fromChapter + 1) : outline.length,
        totalChapters: outline.length,
        scenesGenerated: startSceneNumber - 1 + newScenes.length,
      },
    };

    await db
      .update(scripts)
      .set({
        scriptContent: JSON.stringify(updatedScriptData),
      })
      .where(eq(scripts.id, scriptId));

    // Reload updated script
    const updatedScript = await db.query.scripts.findFirst({
      where: eq(scripts.id, scriptId),
    });

    return NextResponse.json({
      script: updatedScript,
      newScenes,
      hasMore,
      provider: providerId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Failed to generate scenes:', error);
    const message = error instanceof Error ? error.message : '生成场景失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
