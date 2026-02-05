import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, characters, locations, props, scenes } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

/**
 * GET /api/projects/[id]/script-data
 * Load full script data from database tables
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, session.user.id)),
    });
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // Get the latest script version
    const script = await db.query.scripts.findFirst({
      where: eq(scripts.projectId, projectId),
      orderBy: [desc(scripts.version)],
    });

    if (!script) {
      return NextResponse.json({
        script: null,
        characters: [],
        locations: [],
        props: [],
        scenes: [],
      });
    }

    // Load all related data in parallel
    const [projectCharacters, projectLocations, projectProps, scriptScenes] = await Promise.all([
      db.select({
        id: characters.id,
        name: characters.name,
        description: characters.description,
        role: characters.role,
        gender: characters.gender,
        ageGroup: characters.ageGroup,
        prompt: characters.prompt,
        referenceImageUrl: characters.referenceImageUrl,
        characterSheetUrl: characters.characterSheetUrl,
      }).from(characters).where(eq(characters.projectId, projectId)).orderBy(asc(characters.createdAt)),
      db.select({
        id: locations.id,
        name: locations.name,
        description: locations.description,
        mood: locations.mood,
        prompt: locations.prompt,
        generatedImageUrl: locations.generatedImageUrl,
      }).from(locations).where(eq(locations.projectId, projectId)).orderBy(asc(locations.createdAt)),
      db.select({
        id: props.id,
        name: props.name,
        description: props.description,
        significance: props.significance,
        prompt: props.prompt,
        generatedImageUrl: props.generatedImageUrl,
      }).from(props).where(eq(props.projectId, projectId)).orderBy(asc(props.createdAt)),
      db.query.scenes.findMany({
        where: eq(scenes.scriptId, script.id),
        orderBy: [asc(scenes.orderIndex)],
      }),
    ]);

    // Debug logging
    console.log('[script-data] Loaded characters:', projectCharacters.map(c => ({
      id: c.id,
      name: c.name,
      characterSheetUrl: c.characterSheetUrl,
    })));

    return NextResponse.json({
      script,
      characters: projectCharacters,
      locations: projectLocations,
      props: projectProps,
      scenes: scriptScenes,
    });
  } catch (error) {
    console.error('Failed to load script data:', error);
    const message = error instanceof Error ? error.message : '加载剧本数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
