// Queue job types and payloads

export type JobType = 'image' | 'video' | 'voice' | 'music' | 'composite'

export type JobPriority = 1 | 2 | 3 | 4 | 5 // 1 = highest

export interface BaseJobData {
  projectId: string
  userId: string
  priority?: JobPriority
}

// Image generation job
export interface ImageJobData extends BaseJobData {
  type: 'image'
  sceneId: string
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  referenceImage?: string
  characterIds?: string[] // For character consistency
}

// Video generation job
export interface VideoJobData extends BaseJobData {
  type: 'video'
  sceneId: string
  imageUrl: string // Source image for img2video
  prompt?: string
  duration?: number
}

// Voice generation job (TTS)
export interface VoiceJobData extends BaseJobData {
  type: 'voice'
  sceneId: string
  text: string
  voiceId: string
  characterId?: string
  speed?: number
}

// Music generation job
export interface MusicJobData extends BaseJobData {
  type: 'music'
  prompt: string
  duration: number
  style?: string
  instrumental?: boolean
}

// Final video composite job
export interface CompositeJobData extends BaseJobData {
  type: 'composite'
  sceneIds: string[]
  outputFormat?: 'mp4' | 'webm'
  resolution?: '720p' | '1080p' | '4k'
}

export type GenerateJobData =
  | ImageJobData
  | VideoJobData
  | VoiceJobData
  | MusicJobData
  | CompositeJobData

// Job result types
export interface JobResult {
  success: boolean
  outputUrl?: string
  error?: string
  metadata?: Record<string, unknown>
}

// Job status for tracking
export interface JobStatus {
  id: string
  type: JobType
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  data: GenerateJobData
  result?: JobResult
  failedReason?: string
  createdAt: Date
  processedAt?: Date
  finishedAt?: Date
}
