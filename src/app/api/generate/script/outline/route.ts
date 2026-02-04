import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAvailableLLMProvider } from '@/lib/providers/llm';
import { SCRIPT_OUTLINE_SYSTEM_PROMPT, SCRIPT_OUTLINE_USER_PROMPT } from '@/lib/prompts/script';

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

    const { projectId, content } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: '请输入故事内容' }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // Get available LLM provider
    const llmResult = await getAvailableLLMProvider(session.user.id);
    if (!llmResult) {
      return NextResponse.json(
        { error: '请先配置 LLM 服务的 API Key' },
        { status: 400 }
      );
    }

    const { provider, providerId } = llmResult;

    // Generate outline
    const result = await provider.generate({
      messages: [
        { role: 'system', content: SCRIPT_OUTLINE_SYSTEM_PROMPT },
        { role: 'user', content: SCRIPT_OUTLINE_USER_PROMPT(content) },
      ],
      temperature: 0.7,
      maxTokens: 8192,
    });

    // Parse the outline
    let outlineData;
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
        outlineData = JSON.parse(jsonStr.trim());
      } catch {
        console.warn('Initial JSON parse failed, attempting repair...');
        const repairedJson = repairTruncatedJson(jsonStr.trim());
        outlineData = JSON.parse(repairedJson);
      }
    } catch (parseError) {
      console.error('Failed to parse outline JSON:', parseError);
      return NextResponse.json(
        { error: '解析大纲失败，请重试' },
        { status: 500 }
      );
    }

    // Get the latest version number
    const latestScript = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });
    const newVersion = (latestScript?.version || 0) + 1;

    // Create script record
    const [newScript] = await db
      .insert(scripts)
      .values({
        projectId,
        title: outlineData.title,
        synopsis: outlineData.synopsis,
        content: content.trim(),
        outline: outlineData.outline,
        generationState: {
          phase: 'outline',
          currentChapter: 1,
          totalChapters: outlineData.outline?.length || 1,
          scenesGenerated: 0,
        },
        // Keep scriptContent for backward compatibility
        scriptContent: JSON.stringify({
          ...outlineData,
          scenes: [],
          generationState: {
            phase: 'outline',
            currentChapter: 1,
            totalChapters: outlineData.outline?.length || 1,
            scenesGenerated: 0,
          },
        }),
        version: newVersion,
      })
      .returning();

    // Save characters, locations, props to their respective tables
    const { saveScriptOutline } = await import('@/lib/services/script-persistence');
    await saveScriptOutline(projectId, newScript.id, outlineData);

    // Update project status
    await db
      .update(projects)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({
      script: newScript,
      scriptData: outlineData,
      provider: providerId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Failed to generate outline:', error);
    const message = error instanceof Error ? error.message : '生成大纲失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
