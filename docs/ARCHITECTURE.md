# AI短剧制作平台 - 实现方案

## 项目概述

一个Web端AI短剧制作平台，支持完整的制作流程：剧本生成 → 概念图 → 视频生成 → 配音配乐 → 合成导出。采用插件化架构，可灵活切换国内外AI服务。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Next.js 14+)                      │
│  - App Router                                                │
│  - React Server Components                                   │
│  - Tailwind CSS + shadcn/ui                                 │
│  - Zustand (状态管理)                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)            │
│  - /api/projects      项目管理                               │
│  - /api/generate/*    AI生成接口                             │
│  - /api/assets        素材管理                               │
│  - /api/compose       视频合成                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Provider Adapter                       │
│  统一接口，适配不同AI服务                                     │
│  - LLM: OpenAI / Claude / 通义千问                          │
│  - Image: Midjourney / DALL-E / 可图                        │
│  - Video: Runway / Kling / Vidu                             │
│  - Voice: ElevenLabs / 讯飞 / Azure TTS                     │
│  - Music: Suno / Udio / 网易天音                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     数据存储层                                │
│  - PostgreSQL (项目/任务元数据)                              │
│  - S3/R2 (素材文件存储)                                      │
│  - Redis (任务队列/缓存)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心模块设计

### 1. 项目管理模块
- 创建/编辑/删除项目
- 项目状态追踪
- 版本历史

### 2. 剧本工作台
- AI生成剧本（可选择LLM）
- 手动编辑剧本
- 分场/分镜拆解
- 导入外部剧本

### 3. 素材生成模块
- **概念图生成**：根据分镜描述生成参考图
- **角色一致性**：支持角色参考图上传，保持跨镜头一致
- **视频生成**：图生视频/文生视频
- **配音生成**：文本转语音，多角色支持
- **配乐生成**：根据场景生成背景音乐

### 4. 素材管理
- 上传本地素材（图片/视频/音频）
- 素材库浏览和检索
- 素材标签管理

### 5. 时间线编辑器
- 可视化时间线
- 拖拽排列片段
- 添加转场效果
- 字幕编辑

### 6. 导出合成
- 调用FFmpeg（服务端或WASM）
- 多分辨率导出
- 进度追踪

---

## AI Provider 插件化设计

```typescript
// 统一接口定义
interface AIProvider<T extends ProviderType> {
  name: string;
  type: T;
  generate(input: ProviderInput[T]): Promise<ProviderOutput[T]>;
  checkStatus(taskId: string): Promise<TaskStatus>;
}

// 注册表模式
const providerRegistry = {
  llm: {
    openai: new OpenAIProvider(),
    claude: new ClaudeProvider(),
    qwen: new QwenProvider(),
  },
  image: {
    dalle: new DalleProvider(),
    midjourney: new MidjourneyProvider(),
    ketu: new KetuProvider(),
  },
  video: {
    runway: new RunwayProvider(),
    kling: new KlingProvider(),
    vidu: new ViduProvider(),
  },
  voice: {
    elevenlabs: new ElevenLabsProvider(),
    xunfei: new XunfeiProvider(),
  },
  music: {
    suno: new SunoProvider(),
  }
};
```

---

## 数据库设计

### 核心表结构

```sql
-- 用户表
users (
  id, email, password_hash, name,
  created_at, updated_at
)

-- 用户API Key配置（加密存储）
user_api_keys (
  id, user_id,
  provider,           -- 'openai' | 'claude' | 'kling' | ...
  encrypted_key,      -- AES加密后的API Key
  created_at, updated_at
)

-- 项目表
projects (
  id, user_id, name, description, status,
  created_at, updated_at
)

-- 剧本表
scripts (
  id, project_id, content, version,
  created_at
)

-- 场景/分镜表
scenes (
  id, script_id, order_index,
  description, dialogue, duration,
  reference_image_url
)

-- 素材表
assets (
  id, project_id, scene_id,
  type: 'image' | 'video' | 'audio' | 'music',
  source: 'generated' | 'uploaded',
  provider, prompt, url,
  metadata, created_at
)

-- AI任务表
ai_tasks (
  id, project_id, asset_id,
  provider, type, status,
  input, output, error,
  created_at, completed_at
)

-- 时间线表
timeline (
  id, project_id,
  tracks: jsonb,  -- 多轨道数据
  created_at, updated_at
)
```

---

## 页面结构

```
/                       首页/项目列表
/project/new            创建新项目
/project/[id]           项目工作台（主界面）
  ├── /script           剧本编辑
  ├── /storyboard       分镜设计
  ├── /assets           素材库
  ├── /timeline         时间线编辑
  └── /export           导出设置
/settings               用户设置（API Key配置）
```

---

## 项目目录结构

```
ai-video-studio/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (main)/
│   │   ├── page.tsx                 # 项目列表
│   │   ├── project/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx         # 项目概览
│   │   │       ├── script/
│   │   │       ├── storyboard/
│   │   │       ├── assets/
│   │   │       ├── timeline/
│   │   │       └── export/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── generate/
│   │   │   ├── script/
│   │   │   ├── image/
│   │   │   ├── video/
│   │   │   ├── voice/
│   │   │   └── music/
│   │   ├── assets/
│   │   └── compose/
│   └── layout.tsx
├── components/
│   ├── ui/                          # shadcn组件
│   ├── editor/
│   │   ├── ScriptEditor.tsx
│   │   ├── StoryboardPanel.tsx
│   │   └── TimelineEditor.tsx
│   ├── providers/
│   │   └── ProviderSelector.tsx     # AI服务选择器
│   └── common/
├── lib/
│   ├── providers/                   # AI Provider适配器
│   │   ├── base.ts
│   │   ├── llm/
│   │   ├── image/
│   │   ├── video/
│   │   ├── voice/
│   │   └── music/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema
│   │   └── queries.ts
│   ├── auth/                       # NextAuth配置
│   ├── storage/                    # S3/R2文件存储
│   └── ffmpeg/                     # 视频合成
├── hooks/
├── stores/                         # Zustand stores
├── types/
└── drizzle/
```

---

## 实现步骤

### Phase 1: 基础框架搭建
1. 初始化Next.js 14项目
2. 配置Tailwind + shadcn/ui
3. 配置PostgreSQL + Drizzle ORM
4. 配置NextAuth.js用户认证
5. 实现基础布局和路由

### Phase 2: 用户系统
1. 注册/登录页面
2. 用户API Key管理页面
3. API Key加密存储

### Phase 3: 项目管理
1. 项目CRUD API
2. 项目列表页面
3. 项目工作台框架

### Phase 4: 剧本模块
1. 剧本编辑器组件
2. LLM Provider适配器（先接OpenAI/Claude）
3. AI生成剧本API
4. 分镜拆解功能

### Phase 5: 图片生成
1. Image Provider适配器
2. 概念图生成API
3. 分镜板UI
4. 素材库管理

### Phase 6: 视频生成
1. Video Provider适配器（先接Kling/Runway）
2. 视频生成API（异步任务）
3. 任务状态轮询/WebSocket推送

### Phase 7: 音频模块
1. Voice Provider适配器
2. Music Provider适配器
3. 配音/配乐生成API

### Phase 8: 时间线编辑器
1. 时间线组件
2. 拖拽排列
3. 预览播放

### Phase 9: 视频合成导出
1. 服务端FFmpeg集成
2. 合成任务队列
3. 导出下载

---

## MVP优先级

**必须有**：
- 用户认证
- API Key管理
- 项目管理
- 剧本生成/编辑
- 图片生成（至少1个provider）
- 视频生成（至少1个provider）
- 简单素材管理
- 基础导出

**可延后**：
- 完整时间线编辑器
- 多provider切换UI
- 配音配乐
- 团队协作

---

## 用户认证方案

使用 **NextAuth.js** 实现用户认证：

```typescript
// 支持的登录方式
- 邮箱密码注册/登录
- 第三方OAuth（GitHub/Google，可选）
```

### API Key管理
- 用户在设置页面配置各服务的API Key
- 服务端加密存储（AES-256）
- 调用AI服务时解密使用
- 前端不暴露原始Key

---

## 安全考虑

1. **API Key加密**：使用AES-256加密存储，服务端环境变量管理密钥
2. **请求校验**：所有API请求校验用户身份
3. **Rate Limiting**：防止滥用
4. **HTTPS**：生产环境强制HTTPS

---

## 验证方式

1. 注册账号并登录
2. 配置AI服务的API Key
3. 创建一个测试项目
4. 输入故事主题，AI生成剧本
5. 为每个分镜生成概念图
6. 选择概念图生成视频片段
7. 将视频片段导出为完整视频
