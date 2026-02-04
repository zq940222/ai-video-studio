import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const assetTypeEnum = pgEnum('asset_type', ['image', 'video', 'audio', 'music']);
export const assetSourceEnum = pgEnum('asset_source', ['generated', 'uploaded']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'processing', 'completed', 'failed']);
export const projectStatusEnum = pgEnum('project_status', ['draft', 'in_progress', 'completed', 'archived']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User API Keys (encrypted)
export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'openai' | 'claude' | 'qwen' | 'kling' | etc.
  encryptedKey: text('encrypted_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Scripts (versions of script for a project)
export const scripts = pgTable('scripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  content: text('content').notNull(), // Original text/novel content
  scriptContent: text('script_content'), // AI-converted script
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Characters
export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'), // AI-generated character description
  prompt: text('prompt'), // Prompt for generating character images
  referenceImageUrl: text('reference_image_url'), // User-uploaded reference
  characterSheetUrl: text('character_sheet_url'), // Generated character sheet (3-view)
  voiceId: text('voice_id'), // TTS voice identifier
  metadata: jsonb('metadata'), // Additional character data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Scenes (storyboard scenes)
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  scriptId: uuid('script_id').notNull().references(() => scripts.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  description: text('description').notNull(), // Scene description
  dialogue: text('dialogue'), // Character dialogue
  duration: integer('duration'), // Estimated duration in seconds
  imagePrompt: text('image_prompt'), // AI-generated or user-edited prompt
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Assets (generated/uploaded media files)
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sceneId: uuid('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
  characterId: uuid('character_id').references(() => characters.id, { onDelete: 'set null' }),
  type: assetTypeEnum('type').notNull(),
  source: assetSourceEnum('source').notNull(),
  provider: text('provider'), // AI provider used (e.g., 'comfyui', 'kling')
  prompt: text('prompt'), // Generation prompt
  url: text('url').notNull(), // Storage URL (MinIO)
  thumbnailUrl: text('thumbnail_url'),
  metadata: jsonb('metadata'), // Width, height, duration, etc.
  isSelected: boolean('is_selected').default(false), // Selected as final choice
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// AI Tasks (async generation tasks)
export const aiTasks = pgTable('ai_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(), // 'comfyui' | 'kling' | 'qwen' | etc.
  type: text('type').notNull(), // 'text-to-image' | 'image-to-video' | 'tts' | etc.
  status: taskStatusEnum('status').default('pending').notNull(),
  input: jsonb('input'), // Task input parameters
  output: jsonb('output'), // Task result
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Timeline (video editing timeline)
export const timelines = pgTable('timelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tracks: jsonb('tracks').notNull().default([]), // Array of track data
  duration: integer('duration').default(0), // Total duration in ms
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(userApiKeys),
  projects: many(projects),
}));

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  scripts: many(scripts),
  characters: many(characters),
  assets: many(assets),
  aiTasks: many(aiTasks),
  timelines: many(timelines),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  project: one(projects, {
    fields: [scripts.projectId],
    references: [projects.id],
  }),
  scenes: many(scenes),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  project: one(projects, {
    fields: [characters.projectId],
    references: [projects.id],
  }),
  assets: many(assets),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  script: one(scripts, {
    fields: [scenes.scriptId],
    references: [scripts.id],
  }),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id],
  }),
  scene: one(scenes, {
    fields: [assets.sceneId],
    references: [scenes.id],
  }),
  character: one(characters, {
    fields: [assets.characterId],
    references: [characters.id],
  }),
}));

export const aiTasksRelations = relations(aiTasks, ({ one }) => ({
  project: one(projects, {
    fields: [aiTasks.projectId],
    references: [projects.id],
  }),
  asset: one(assets, {
    fields: [aiTasks.assetId],
    references: [assets.id],
  }),
}));

export const timelinesRelations = relations(timelines, ({ one }) => ({
  project: one(projects, {
    fields: [timelines.projectId],
    references: [projects.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Script = typeof scripts.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AiTask = typeof aiTasks.$inferSelect;
export type Timeline = typeof timelines.$inferSelect;
