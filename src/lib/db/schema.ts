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
export const authTypeEnum = pgEnum('auth_type', ['api_key', 'oauth']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User API Keys (encrypted) - supports both API Key and OAuth
export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'openai' | 'claude' | 'qwen' | 'kling' | etc.
  authType: authTypeEnum('auth_type').default('api_key').notNull(), // 'api_key' or 'oauth'
  encryptedKey: text('encrypted_key'), // For API Key auth (encrypted)
  // OAuth fields (all encrypted)
  encryptedAccessToken: text('encrypted_access_token'), // OAuth access token
  encryptedRefreshToken: text('encrypted_refresh_token'), // OAuth refresh token
  tokenExpiresAt: timestamp('token_expires_at'), // OAuth token expiration
  oauthMetadata: jsonb('oauth_metadata'), // Additional OAuth data (user info, scopes, etc.)
  // Provider-specific config (model selection, etc.)
  config: jsonb('config'), // { model?: string, ... }
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
  title: text('title'), // 剧本标题
  synopsis: text('synopsis'), // 剧本简介
  content: text('content').notNull(), // Original text/novel content
  scriptContent: text('script_content'), // AI-converted script (legacy, for compatibility)
  outline: jsonb('outline').$type<Array<{ chapter: number; title: string; summary: string; keyEvents: string[] }>>(), // 故事大纲
  generationState: jsonb('generation_state').$type<{ phase: string; currentChapter: number; totalChapters: number; scenesGenerated: number }>(), // 生成状态
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Episodes (分集)
export const episodes = pgTable('episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  scriptId: uuid('script_id').references(() => scripts.id, { onDelete: 'set null' }),
  episodeNumber: integer('episode_number').notNull(), // 集数
  title: text('title').notNull(), // 分集标题
  synopsis: text('synopsis'), // 分集简介
  duration: integer('duration'), // 预计时长（秒）
  status: projectStatusEnum('status').default('draft').notNull(),
  metadata: jsonb('metadata'), // 额外数据
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Characters
export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'), // AI-generated character description
  role: text('role'), // 主角/配角/路人
  gender: text('gender'), // male/female
  ageGroup: text('age_group'), // child/teenager/young_adult/middle_aged/elderly
  prompt: text('prompt'), // Prompt for generating character images
  referenceImageUrl: text('reference_image_url'), // User-uploaded reference
  characterSheetUrl: text('character_sheet_url'), // Generated character sheet (3-view)
  voiceId: text('voice_id'), // TTS voice identifier
  metadata: jsonb('metadata'), // Additional character data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Locations (场景/地点)
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 场景名称（如：咖啡厅、办公室）
  description: text('description'), // 场景描述
  prompt: text('prompt'), // 用于生成场景图的提示词
  referenceImageUrl: text('reference_image_url'), // 用户上传的参考图
  generatedImageUrl: text('generated_image_url'), // AI生成的场景图
  timeOfDay: text('time_of_day'), // 日/夜/晨/昏
  mood: text('mood'), // 氛围（温馨、紧张、神秘等）
  metadata: jsonb('metadata'), // 额外数据
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Props (物品/道具)
export const props = pgTable('props', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 物品名称
  description: text('description'), // 物品描述
  prompt: text('prompt'), // 用于生成物品图的提示词
  referenceImageUrl: text('reference_image_url'), // 用户上传的参考图
  generatedImageUrl: text('generated_image_url'), // AI生成的物品图
  significance: text('significance'), // 剧情重要性/作用
  metadata: jsonb('metadata'), // 额外数据
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Scenes (storyboard scenes / 分镜)
export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  scriptId: uuid('script_id').notNull().references(() => scripts.id, { onDelete: 'cascade' }),
  episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'set null' }), // 所属分集
  orderIndex: integer('order_index').notNull(),
  location: text('location'), // 场景地点名称
  timeOfDay: text('time_of_day'), // 日/夜/晨/昏
  description: text('description').notNull(), // Scene description
  actions: jsonb('actions').$type<string[]>(), // 动作描述数组
  dialogues: jsonb('dialogues').$type<Array<{ character: string; line: string; direction?: string }>>(), // 对白
  cameraHints: jsonb('camera_hints').$type<string[]>(), // 镜头提示
  sceneProps: jsonb('scene_props').$type<string[]>(), // 场景中的物品
  duration: integer('duration'), // Estimated duration in seconds
  imagePrompt: text('image_prompt'), // AI-generated or user-edited prompt
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }), // 关联场景
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
  episodes: many(episodes),
  characters: many(characters),
  locations: many(locations),
  props: many(props),
  assets: many(assets),
  aiTasks: many(aiTasks),
  timelines: many(timelines),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  project: one(projects, {
    fields: [scripts.projectId],
    references: [projects.id],
  }),
  episodes: many(episodes),
  scenes: many(scenes),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  project: one(projects, {
    fields: [episodes.projectId],
    references: [projects.id],
  }),
  script: one(scripts, {
    fields: [episodes.scriptId],
    references: [scripts.id],
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

export const locationsRelations = relations(locations, ({ one }) => ({
  project: one(projects, {
    fields: [locations.projectId],
    references: [projects.id],
  }),
}));

export const propsRelations = relations(props, ({ one }) => ({
  project: one(projects, {
    fields: [props.projectId],
    references: [projects.id],
  }),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  script: one(scripts, {
    fields: [scenes.scriptId],
    references: [scripts.id],
  }),
  episode: one(episodes, {
    fields: [scenes.episodeId],
    references: [episodes.id],
  }),
  location: one(locations, {
    fields: [scenes.locationId],
    references: [locations.id],
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
export type Episode = typeof episodes.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Prop = typeof props.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AiTask = typeof aiTasks.$inferSelect;
export type Timeline = typeof timelines.$inferSelect;
