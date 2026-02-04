/**
 * Script persistence service
 * Saves generated script data to database tables
 */

import { db } from '@/lib/db';
import { scripts, characters, locations, props, scenes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface GeneratedCharacter {
  name: string;
  description: string;
  role?: string;
}

interface GeneratedLocation {
  name: string;
  description: string;
  mood?: string;
}

interface GeneratedProp {
  name: string;
  description: string;
  significance?: string;
}

interface GeneratedScene {
  sceneNumber: number;
  location: string;
  timeOfDay: string;
  description: string;
  actions: string[];
  dialogues: Array<{ character: string; line: string; direction?: string }>;
  cameraHints?: string[];
  props?: string[];
}

interface OutlineChapter {
  chapter: number;
  title: string;
  summary: string;
  keyEvents: string[];
}

interface ScriptOutlineData {
  title?: string;
  synopsis?: string;
  characters?: GeneratedCharacter[];
  locations?: GeneratedLocation[];
  props?: GeneratedProp[];
  outline?: OutlineChapter[];
  estimatedScenes?: number;
}

interface ScriptScenesData {
  scenes: GeneratedScene[];
  hasMore: boolean;
}

/**
 * Save script outline to database
 * Creates/updates script record and related entities (characters, locations, props)
 */
export async function saveScriptOutline(
  projectId: string,
  scriptId: string,
  data: ScriptOutlineData
): Promise<void> {
  // Update script with outline data
  await db
    .update(scripts)
    .set({
      title: data.title,
      synopsis: data.synopsis,
      outline: data.outline,
      generationState: {
        phase: 'outline',
        currentChapter: 1,
        totalChapters: data.outline?.length || 1,
        scenesGenerated: 0,
      },
      updatedAt: new Date(),
    })
    .where(eq(scripts.id, scriptId));

  // Save characters
  if (data.characters && data.characters.length > 0) {
    // Delete existing characters for this project first
    await db.delete(characters).where(eq(characters.projectId, projectId));

    // Insert new characters
    await db.insert(characters).values(
      data.characters.map((char) => ({
        projectId,
        name: char.name,
        description: char.description,
        role: char.role,
      }))
    );
  }

  // Save locations
  if (data.locations && data.locations.length > 0) {
    // Delete existing locations for this project first
    await db.delete(locations).where(eq(locations.projectId, projectId));

    // Insert new locations
    await db.insert(locations).values(
      data.locations.map((loc) => ({
        projectId,
        name: loc.name,
        description: loc.description,
        mood: loc.mood,
      }))
    );
  }

  // Save props
  if (data.props && data.props.length > 0) {
    // Delete existing props for this project first
    await db.delete(props).where(eq(props.projectId, projectId));

    // Insert new props
    await db.insert(props).values(
      data.props.map((prop) => ({
        projectId,
        name: prop.name,
        description: prop.description,
        significance: prop.significance,
      }))
    );
  }
}

/**
 * Save generated scenes to database
 * Appends new scenes to existing ones
 */
export async function saveScriptScenes(
  scriptId: string,
  data: ScriptScenesData,
  currentChapter: number,
  totalChapters: number
): Promise<void> {
  // Get existing scene count
  const existingScenes = await db.query.scenes.findMany({
    where: eq(scenes.scriptId, scriptId),
    columns: { id: true },
  });
  const startIndex = existingScenes.length;

  // Insert new scenes
  if (data.scenes && data.scenes.length > 0) {
    await db.insert(scenes).values(
      data.scenes.map((scene, index) => ({
        scriptId,
        orderIndex: startIndex + index + 1,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        description: scene.description,
        actions: scene.actions,
        dialogues: scene.dialogues,
        cameraHints: scene.cameraHints,
        sceneProps: scene.props,
      }))
    );
  }

  // Update script generation state
  const totalScenes = startIndex + data.scenes.length;
  const nextChapter = data.hasMore ? currentChapter + 1 : totalChapters;
  const phase = data.hasMore && nextChapter <= totalChapters ? 'scenes' : 'complete';

  await db
    .update(scripts)
    .set({
      generationState: {
        phase,
        currentChapter: nextChapter,
        totalChapters,
        scenesGenerated: totalScenes,
      },
      updatedAt: new Date(),
    })
    .where(eq(scripts.id, scriptId));
}

/**
 * Load full script data from database
 * Combines script record with related entities
 */
export async function loadScriptData(scriptId: string): Promise<{
  script: typeof scripts.$inferSelect;
  characters: Array<typeof characters.$inferSelect>;
  locations: Array<typeof locations.$inferSelect>;
  props: Array<typeof props.$inferSelect>;
  scenes: Array<typeof scenes.$inferSelect>;
} | null> {
  const script = await db.query.scripts.findFirst({
    where: eq(scripts.id, scriptId),
  });

  if (!script) {
    return null;
  }

  const [projectCharacters, projectLocations, projectProps, scriptScenes] = await Promise.all([
    db.query.characters.findMany({
      where: eq(characters.projectId, script.projectId),
      orderBy: (characters, { asc }) => [asc(characters.createdAt)],
    }),
    db.query.locations.findMany({
      where: eq(locations.projectId, script.projectId),
      orderBy: (locations, { asc }) => [asc(locations.createdAt)],
    }),
    db.query.props.findMany({
      where: eq(props.projectId, script.projectId),
      orderBy: (props, { asc }) => [asc(props.createdAt)],
    }),
    db.query.scenes.findMany({
      where: eq(scenes.scriptId, scriptId),
      orderBy: (scenes, { asc }) => [asc(scenes.orderIndex)],
    }),
  ]);

  return {
    script,
    characters: projectCharacters,
    locations: projectLocations,
    props: projectProps,
    scenes: scriptScenes,
  };
}

/**
 * Load script data by project ID (gets the latest version)
 */
export async function loadScriptDataByProject(projectId: string): Promise<{
  script: typeof scripts.$inferSelect;
  characters: Array<typeof characters.$inferSelect>;
  locations: Array<typeof locations.$inferSelect>;
  props: Array<typeof props.$inferSelect>;
  scenes: Array<typeof scenes.$inferSelect>;
} | null> {
  const script = await db.query.scripts.findFirst({
    where: eq(scripts.projectId, projectId),
    orderBy: (scripts, { desc }) => [desc(scripts.version)],
  });

  if (!script) {
    return null;
  }

  return loadScriptData(script.id);
}
