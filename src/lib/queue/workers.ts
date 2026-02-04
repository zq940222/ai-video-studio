// BullMQ Workers for processing generation jobs
import { Worker, Job } from 'bullmq'
import { getWorkerConnection } from './connection'
import type {
  GenerateJobData,
  JobResult,
  ImageJobData,
  VideoJobData,
  VoiceJobData,
  MusicJobData,
  CompositeJobData,
} from './types'

// Import ComfyUI providers
import { ComfyUIProvider } from '@/lib/providers/image/comfyui'
import { ComfyUIVideoProvider } from '@/lib/providers/video/comfyui'
import { ComfyUIVoiceProvider } from '@/lib/providers/voice/comfyui'
import { ComfyUIMusicProvider } from '@/lib/providers/music/comfyui'

// Provider instances (lazy initialized to ensure env vars are loaded)
let imageProvider: ComfyUIProvider | null = null
let videoProvider: ComfyUIVideoProvider | null = null
let voiceProvider: ComfyUIVoiceProvider | null = null
let musicProvider: ComfyUIMusicProvider | null = null

function getComfyUIUrl(): string {
  return process.env.COMFYUI_URL || 'http://localhost:8188'
}

function getImageProvider(): ComfyUIProvider {
  if (!imageProvider) {
    const url = getComfyUIUrl()
    console.log(`[Worker] Initializing image provider with URL: ${url}, checkpoint: ${process.env.COMFYUI_CHECKPOINT}`)
    imageProvider = new ComfyUIProvider(url)
  }
  return imageProvider
}

function getVideoProvider(): ComfyUIVideoProvider {
  if (!videoProvider) {
    videoProvider = new ComfyUIVideoProvider(getComfyUIUrl())
  }
  return videoProvider
}

function getVoiceProvider(): ComfyUIVoiceProvider {
  if (!voiceProvider) {
    voiceProvider = new ComfyUIVoiceProvider(getComfyUIUrl())
  }
  return voiceProvider
}

function getMusicProvider(): ComfyUIMusicProvider {
  if (!musicProvider) {
    musicProvider = new ComfyUIMusicProvider(getComfyUIUrl())
  }
  return musicProvider
}

// Helper to check if ComfyUI is available
async function ensureComfyUIAvailable(): Promise<void> {
  const provider = getImageProvider()
  const available = await provider.isAvailable()
  if (!available) {
    throw new Error(`ComfyUI is not available at ${getComfyUIUrl()}`)
  }
}

// Process image generation
async function processImageJob(job: Job<ImageJobData>): Promise<JobResult> {
  const { prompt, negativePrompt, width, height, referenceImage } = job.data

  console.log(`\n[Image] ========================================`)
  console.log(`[Image] Processing job ${job.id}`)
  console.log(`[Image] Prompt: "${prompt.substring(0, 50)}..."`)
  console.log(`[Image] Size: ${width || 1024}x${height || 1024}`)
  await job.updateProgress(5)

  try {
    await ensureComfyUIAvailable()
    await job.updateProgress(10)

    const result = await getImageProvider().generate({
      prompt,
      negativePrompt,
      width: width || 1024,
      height: height || 1024,
      referenceImage,
    })

    await job.updateProgress(100)
    console.log(`[Image] Completed: ${result.url}`)

    return {
      success: true,
      outputUrl: result.url,
      metadata: {
        width: result.width,
        height: result.height,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed'
    console.error(`[Image] Failed: ${message}`)
    return {
      success: false,
      error: message,
    }
  }
}

// Process video generation (image-to-video)
async function processVideoJob(job: Job<VideoJobData>): Promise<JobResult> {
  const { imageUrl, prompt, duration } = job.data

  console.log(`[Video] Processing: image=${imageUrl.substring(0, 50)}...`)
  await job.updateProgress(5)

  try {
    await ensureComfyUIAvailable()
    await job.updateProgress(10)

    const result = await getVideoProvider().generate({
      image: imageUrl,
      prompt: prompt || 'smooth camera motion, cinematic quality',
      duration: duration || 5,
    })

    await job.updateProgress(100)
    console.log(`[Video] Completed: ${result.url}`)

    return {
      success: true,
      outputUrl: result.url,
      metadata: {
        duration: result.duration,
        width: result.width,
        height: result.height,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video generation failed'
    console.error(`[Video] Failed: ${message}`)
    return {
      success: false,
      error: message,
    }
  }
}

// Process voice generation (TTS)
async function processVoiceJob(job: Job<VoiceJobData>): Promise<JobResult> {
  const { text, voiceId, speed } = job.data

  console.log(`[Voice] Processing: "${text.substring(0, 50)}..." with voice=${voiceId}`)
  await job.updateProgress(5)

  try {
    await ensureComfyUIAvailable()
    await job.updateProgress(10)

    const result = await getVoiceProvider().generate({
      text,
      voiceId: voiceId || 'female-narrator',
      speed: speed || 1.0,
    })

    await job.updateProgress(100)
    console.log(`[Voice] Completed: ${result.url}`)

    return {
      success: true,
      outputUrl: result.url,
      metadata: {
        duration: result.duration,
        voiceId,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice generation failed'
    console.error(`[Voice] Failed: ${message}`)
    return {
      success: false,
      error: message,
    }
  }
}

// Process music generation
async function processMusicJob(job: Job<MusicJobData>): Promise<JobResult> {
  const { prompt, duration, style, instrumental } = job.data

  console.log(`[Music] Processing: "${prompt.substring(0, 50)}..." duration=${duration}s`)
  await job.updateProgress(5)

  try {
    await ensureComfyUIAvailable()
    await job.updateProgress(10)

    const result = await getMusicProvider().generate({
      prompt,
      duration: duration || 30,
      style,
      instrumental: instrumental !== false,
    })

    await job.updateProgress(100)
    console.log(`[Music] Completed: ${result.url}`)

    return {
      success: true,
      outputUrl: result.url,
      metadata: {
        duration: result.duration,
        style,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Music generation failed'
    console.error(`[Music] Failed: ${message}`)
    return {
      success: false,
      error: message,
    }
  }
}

// Process final video composite
async function processCompositeJob(job: Job<CompositeJobData>): Promise<JobResult> {
  const { sceneIds, outputFormat, resolution } = job.data

  console.log(`[Composite] Processing ${sceneIds.length} scenes, format=${outputFormat}`)
  await job.updateProgress(5)

  try {
    // TODO: Implement FFmpeg composite
    // 1. Fetch all scene videos from database
    // 2. Fetch voice tracks for each scene
    // 3. Fetch background music
    // 4. Use FFmpeg to:
    //    - Concatenate scene videos with transitions
    //    - Mix voice tracks at appropriate timestamps
    //    - Add background music with ducking
    //    - Export to target format/resolution

    await job.updateProgress(50)

    // Placeholder - actual implementation requires FFmpeg integration
    console.log(`[Composite] FFmpeg integration not yet implemented`)

    await job.updateProgress(100)

    return {
      success: false,
      error: 'Video composite not yet implemented - requires FFmpeg integration',
      metadata: {
        sceneCount: sceneIds.length,
        format: outputFormat,
        resolution,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video composite failed'
    console.error(`[Composite] Failed: ${message}`)
    return {
      success: false,
      error: message,
    }
  }
}

// Main job processor
async function processJob(job: Job<GenerateJobData>): Promise<JobResult> {
  // Force flush stdout
  process.stdout.write(`\n${'='.repeat(60)}\n`)
  process.stdout.write(`Processing job ${job.id} | type: ${job.data.type} | project: ${job.data.projectId}\n`)
  process.stdout.write(`${'='.repeat(60)}\n`)

  const startTime = Date.now()

  let result: JobResult

  switch (job.data.type) {
    case 'image':
      result = await processImageJob(job as Job<ImageJobData>)
      break
    case 'video':
      result = await processVideoJob(job as Job<VideoJobData>)
      break
    case 'voice':
      result = await processVoiceJob(job as Job<VoiceJobData>)
      break
    case 'music':
      result = await processMusicJob(job as Job<MusicJobData>)
      break
    case 'composite':
      result = await processCompositeJob(job as Job<CompositeJobData>)
      break
    default:
      result = { success: false, error: 'Unknown job type' }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Job ${job.id} finished in ${elapsed}s | success: ${result.success}`)

  return result
}

// Worker instance (singleton)
let worker: Worker<GenerateJobData, JobResult> | null = null

// Start worker
export function startWorker(concurrency: number = 1) {
  if (worker) {
    console.log('Worker already running')
    return worker
  }

  console.log(`\nComfyUI URL: ${getComfyUIUrl()}`)

  worker = new Worker<GenerateJobData, JobResult>('generate', processJob, {
    connection: getWorkerConnection(),
    concurrency,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // Per minute
    },
  })

  worker.on('completed', (job, result) => {
    const status = result.success ? '✓ success' : '✗ failed'
    console.log(`Job ${job.id} completed: ${status}`)
    if (result.outputUrl) {
      console.log(`  Output: ${result.outputUrl}`)
    }
    if (result.error) {
      console.log(`  Error: ${result.error}`)
    }
  })

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed with exception:`, error.message)
  })

  worker.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}%`)
  })

  worker.on('error', (error) => {
    console.error('Worker error:', error)
  })

  console.log(`Worker started with concurrency: ${concurrency}`)
  return worker
}

// Stop worker gracefully
export async function stopWorker() {
  if (worker) {
    await worker.close()
    worker = null
    console.log('Worker stopped')
  }
}

// Get worker status
export function getWorkerStatus() {
  if (!worker) return { running: false }

  return {
    running: !worker.isPaused(),
    concurrency: worker.opts.concurrency,
  }
}
