// Test with inline worker to isolate the issue
import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { addGenerateJob, getJobStatus, generateQueue, type GenerateJobData, type JobResult, type ImageJobData } from '../src/lib/queue'
import { ComfyUIProvider } from '../src/lib/providers/image/comfyui'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188'

async function testInlineWorker() {
  console.log('=== Testing with Inline Worker ===\n')
  console.log(`Redis: ${REDIS_URL}`)
  console.log(`ComfyUI: ${COMFYUI_URL}`)
  console.log(`Checkpoint: ${process.env.COMFYUI_CHECKPOINT}\n`)

  // Clear old jobs
  await generateQueue.obliterate({ force: true })
  console.log('Cleared queue\n')

  // Create ComfyUI provider
  const imageProvider = new ComfyUIProvider(COMFYUI_URL)
  console.log(`Provider checkpoint: ${(imageProvider as any).config.checkpointName}`)

  // Check ComfyUI availability
  const available = await imageProvider.isAvailable()
  console.log(`ComfyUI available: ${available}\n`)

  if (!available) {
    console.log('ComfyUI not available!')
    process.exit(1)
  }

  // Create inline worker
  const worker = new Worker<GenerateJobData, JobResult>(
    'generate',
    async (job: Job<GenerateJobData>) => {
      console.log(`\n>>> Processing job ${job.id} type: ${job.data.type} <<<`)

      if (job.data.type === 'image') {
        const data = job.data as ImageJobData
        console.log(`Prompt: "${data.prompt.substring(0, 50)}..."`)

        await job.updateProgress(10)

        try {
          const result = await imageProvider.generate({
            prompt: data.prompt,
            negativePrompt: data.negativePrompt,
            width: data.width || 512,
            height: data.height || 512,
          })

          await job.updateProgress(100)
          console.log(`Generated image: ${result.url}`)

          return {
            success: true,
            outputUrl: result.url,
            metadata: { width: result.width, height: result.height },
          }
        } catch (error) {
          console.error('Generation error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }

      return { success: false, error: 'Unsupported job type' }
    },
    { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) }
  )

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result.success ? 'success' : 'failed')
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message)
  })

  console.log('Worker started\n')

  // Wait for worker to be ready
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Add job
  console.log('Adding image job...')
  const { id } = await addGenerateJob({
    type: 'image',
    projectId: 'test',
    userId: 'test',
    sceneId: 'test',
    prompt: '一个美丽的山水风景',
    width: 512,
    height: 512,
  })
  console.log(`Job added: ${id}\n`)

  // Wait for completion
  const maxWait = 120000
  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    const status = await getJobStatus(id)
    if (status?.state === 'completed' || status?.state === 'failed') {
      console.log('\n=== Final Status ===')
      console.log(JSON.stringify(status, null, 2))
      break
    }
    process.stdout.write(`\rWaiting... ${((Date.now() - startTime) / 1000).toFixed(0)}s`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Cleanup
  await worker.close()
  await generateQueue.close()

  console.log('\nTest complete!')
  process.exit(0)
}

testInlineWorker().catch(console.error)
