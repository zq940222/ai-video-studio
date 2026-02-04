# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

AI短剧制作平台，集成多种AI服务实现从剧本到成片的完整制作流程。

### 剧本工作流

1. **输入来源**：用户上传文本/小说，或手动编写
2. **AI转换**：文本 → 剧本 → 分镜脚本（通过LLM Provider）
3. **后续流程**：分镜脚本 → 概念图 → 视频生成 → 配音配乐 → 合成导出

### 角色工作流

1. **角色信息生成**：AI根据剧本自动提取/生成角色描述
2. **角色图生成**：
   - 方式一：AI生成提示词 → 生成角色三面图
   - 方式二：用户上传角色图 → 图生图生成角色三面图
3. **角色一致性**：角色图用于后续分镜概念图生成，保持跨镜头一致

### 分镜图工作流

1. **提示词生成**：AI根据分镜脚本自动生成图片提示词
2. **提示词微调**：用户可手动编辑提示词进行调整
3. **多图生成**：每个分镜可生成多张候选图（降低迭代次数）
4. **图生视频**：选取多张分镜图 → 图生视频串联成片段
5. **迭代优化**：图片/视频不满意可重新生成或调整提示词

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm db:push      # 推送数据库schema到PostgreSQL
pnpm db:studio    # 打开Drizzle Studio查看数据
```

启动前需要配置 `.env.local`（参考 `.env.example`）并运行 `docker-compose up -d` 启动数据库。

## 技术栈

- Next.js 14 (App Router) + React Server Components
- Tailwind CSS + shadcn/ui
- PostgreSQL + Drizzle ORM
- NextAuth.js（邮箱密码登录）
- Zustand 状态管理
- MinIO 文件存储
- FFmpeg 视频合成
- ComfyUI 图像/视频生成后端（本地部署，节约成本）
- Wan2.1 视频生成模型（真人视频）

## 核心架构

### AI Provider 插件化设计

所有AI服务通过统一接口适配，位于 `lib/providers/` 目录：

```typescript
interface AIProvider<T extends ProviderType> {
  name: string;
  type: T;
  generate(input: ProviderInput[T]): Promise<ProviderOutput[T]>;
  checkStatus(taskId: string): Promise<TaskStatus>;
}
```

Provider类型包括：LLM、Image、Video、Voice、Music。每种类型支持多个服务商（如LLM支持OpenAI/Claude/通义千问）。新增Provider需实现此接口并注册到 `providerRegistry`。

### 生成后端架构

采用ComfyUI全链路本地生成，大幅节约成本：

```
┌─────────────────────────────────────────────────────────┐
│              ComfyUI 本地生成 (优先)                     │
├─────────────────────────────────────────────────────────┤
│  文生图/图生图  : FLUX / SD + ControlNet + IP-Adapter   │
│  文生视频/图生视频: Wan2.1 (真人视频)                    │
│  配音TTS       : Qwen3-TTS / MegaTTS3 (多角色+语音克隆) │
│  配乐          : ACE-Step / Stable Audio 2.5           │
│  音频处理      : MusicTools (人声分离/降噪)             │
├─────────────────────────────────────────────────────────┤
│              云端API (备选)                              │
├─────────────────────────────────────────────────────────┤
│  LLM          : 通义千问 / GPT (剧本生成)               │
│  商业视频API   : 可灵 / Runway / 即梦 (可选)            │
└─────────────────────────────────────────────────────────┘
```

ComfyUI通过WebSocket API调用，工作流模板预置在 `comfyui/workflows/` 目录。

### 部署策略

```
开发阶段: 本地GPU (3070Ti 8G)
  - 单任务串行执行，模型按需加载切换
  - Wan2.1 / FLUX / TTS 分时复用显存

生产阶段: ComfyUI Cloud 或 自建GPU集群
  - 多任务并行，独立显存
  - 按需扩缩容
```

### API Key管理

用户自行配置各AI服务的API Key，服务端使用AES-256加密存储，调用时解密，前端永不暴露原始Key。

## 目录结构

- `app/(auth)/` - 登录/注册页面
- `app/(main)/` - 主应用页面（项目列表、工作台）
- `app/api/generate/` - AI生成API（script/image/video/voice/music）
- `components/editor/` - 编辑器组件（ScriptEditor, StoryboardPanel, TimelineEditor）
- `lib/providers/{llm,image,video,voice,music}/` - 各类AI服务适配器
- `lib/db/schema.ts` - Drizzle数据库schema
- `stores/` - Zustand stores

## 开发约定

- 组件名: PascalCase，其他文件: kebab-case
- API路由: kebab-case
- 数据库schema定义在 `lib/db/schema.ts`

## 关键文件

- `docs/ARCHITECTURE.md` - 完整架构设计文档（数据库表结构、页面结构、实现步骤）
- `docs/COMPETITIVE-ANALYSIS.md` - 竞品分析（火宝/蛙蛙写作/TapNow/可梦AI）
- `lib/providers/base.ts` - AI Provider基类和接口定义

## 当前状态

项目处于初始阶段，下一步是基础框架搭建。
