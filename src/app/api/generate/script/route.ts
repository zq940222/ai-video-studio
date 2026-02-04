import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAvailableLLMProvider } from '@/lib/providers/llm';
import { SCRIPT_SYSTEM_PROMPT, SCRIPT_USER_PROMPT } from '@/lib/prompts/script';

/**
 * Attempt to repair truncated JSON by closing unclosed brackets and braces
 */
function repairTruncatedJson(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // Remove trailing comma if present
  repaired = repaired.replace(/,\s*$/, '');

  // Remove incomplete key-value pair at the end (e.g., "key": or "key": ")
  repaired = repaired.replace(/,?\s*"[^"]*":\s*"?[^"]*$/, '');
  repaired = repaired.replace(/,?\s*"[^"]*":\s*$/, '');

  // Count unclosed brackets and braces
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of repaired) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }

  // If we're still in a string, close it
  if (inString) {
    repaired += '"';
  }

  // Close unclosed brackets and braces
  while (bracketCount > 0) {
    repaired += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    repaired += '}';
    braceCount--;
  }

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
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id)
      ),
    });

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // Get available LLM provider
    const llmResult = await getAvailableLLMProvider(session.user.id);

    if (!llmResult) {
      return NextResponse.json(
        { error: '请先配置 LLM 服务（OpenAI 或通义千问）的 API Key' },
        { status: 400 }
      );
    }

    const { provider, providerId } = llmResult;

    // Generate script using LLM
    const result = await provider.generate({
      messages: [
        { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
        { role: 'user', content: SCRIPT_USER_PROMPT(content) },
      ],
      temperature: 0.7,
      maxTokens: 16384,
    });

    // Parse the generated script
    let scriptData;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = result.content;

      // Try multiple patterns to extract JSON
      // Pattern 1: ```json ... ``` or ``` ... ```
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        // Pattern 2: Find JSON object directly { ... }
        const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
        }
      }

      // Try to parse JSON, with fallback for truncated responses
      try {
        scriptData = JSON.parse(jsonStr.trim());
      } catch (initialParseError) {
        console.warn('Initial JSON parse failed, attempting repair...');
        // Try to repair truncated JSON
        const repairedJson = repairTruncatedJson(jsonStr.trim());
        scriptData = JSON.parse(repairedJson);
        console.log('JSON repair successful');
      }

      // Validate the parsed data has expected structure
      if (!scriptData || typeof scriptData !== 'object') {
        throw new Error('Invalid script data structure');
      }

      // Ensure required fields exist
      if (!scriptData.scenes && !scriptData.characters && !scriptData.title) {
        console.warn('Script data missing expected fields:', Object.keys(scriptData));
      }
    } catch (parseError) {
      console.error('Failed to parse script JSON:', parseError);
      console.error('Raw content:', result.content.substring(0, 500));
      // If parsing fails, store the raw content
      scriptData = { raw: result.content };
    }

    // Get the latest version number
    const latestScript = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    const newVersion = (latestScript?.version || 0) + 1;

    // Save the script
    const [newScript] = await db
      .insert(scripts)
      .values({
        projectId,
        content: content.trim(),
        scriptContent: JSON.stringify(scriptData),
        version: newVersion,
      })
      .returning();

    // Update project status
    await db
      .update(projects)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({
      script: newScript,
      scriptData,
      provider: providerId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Failed to generate script:', error);
    const message = error instanceof Error ? error.message : '生成剧本失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
