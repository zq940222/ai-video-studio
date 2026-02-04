// Completely isolated test - no queue module import
import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { ComfyUIProvider } from '../src/lib/providers/image/comfyui'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188'

interface ImageJobData {
  prompt: string
  width?: number
  height?: number
}

async function test() {
  console.log('=== Isolated Test ===\n')
  console.log(`Redis: ${REDIS_URL}`)
  console.log(`ComfyUI: ${COMFYUI_URL}`)
  console.log(`Checkpoint: ${process.env.COMFYUI_CHECKPOINT}\n`)

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

  // Delete ALL bull keys to ensure clean state
  const allKeys = await connection.keys('bull:*')
  if (allKeys.length > 0) {
    await connection.del(...allKeys)
    console.log(`Deleted ${allKeys.length} keys`)
  }

  // Create queue
  const queue = new Queue<ImageJobData>('isolated-test', { connection })
  console.log('Queue created')

  // Create provider
  const provider = new ComfyUIProvider(COMFYUI_URL)
  console.log(`Provider config: ${JSON.stringify((provider as any).config)}`)

  const available = await provider.isAvailable()
  console.log(`ComfyUI available: ${available}\n`)

  if (!available) {
    console.log('ComfyUI not available!')
    await queue.close()
    await connection.quit()
    process.exit(1)
  }

  // Create worker
  const worker = new Worker<ImageJobData>(
    'isolated-test',
    async (job) => {
      console.log(`\n[WORKER] Processing job ${job.id}`)
      console.log(`[WORKER] Prompt: ${job.data.prompt}`)

      await job.updateProgress(10)

      try {
        console.log('[WORKER] Calling provider.generate...')
        const result = await provider.generate({
          prompt: job.data.prompt,
          width: job.data.width || 512,
          height: job.data.height || 512,
        })

        console.log(`[WORKER] Success! URL: ${result.url}`)
        await job.updateProgress(100)

        return { success: true, url: result.url }
      } catch (error) {
        console.log(`[WORKER] Error: ${error}`)
        return { success: false, error: String(error) }
      }
    },
    { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) }
  )

  worker.on('completed', (job, result) => {
    console.log(`[EVENT] Job ${job.id} completed:`, result)
  })

  worker.on('failed', (job, err) => {
    console.error(`[EVENT] Job ${job?.id} failed:`, err.message)
  })

  console.log('Worker started')
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Add job
  console.log('\nAdding job...')
  const job = await queue.add('image', {
    prompt: '一个美丽的山水风景',
    width: 512,
    height: 512,
  })
  console.log(`Job added: ${job.id}\n`)

  // Wait for completion with timeout
  const maxWait = 120000
  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    const state = await job.getState()
    if (state === 'completed' || state === 'failed') {
      console.log(`\nJob finished with state: ${state}`)
      console.log('Result:', job.returnvalue)
      break
    }
    process.stdout.write(`\rWaiting... ${((Date.now() - startTime) / 1000).toFixed(0)}s (state: ${state})`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Cleanup
  await worker.close()
  await queue.close()
  await connection.quit()

  console.log('\nTest complete!')
  process.exit(0)
}

test().catch(console.error)
