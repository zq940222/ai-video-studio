// Test worker with ComfyUI integration
import IORedis from 'ioredis'
import { startWorker, stopWorker, addGenerateJob, getJobStatus, generateQueue, connection } from '../src/lib/queue'

// Helper to completely clear Redis queue data
async function clearRedisQueue() {
  const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379')
  const keys = await redis.keys('bull:generate:*')
  if (keys.length > 0) {
    await redis.del(...keys)
    console.log(`Deleted ${keys.length} Redis keys`)
  }
  await redis.quit()
}

async function testWorker() {
  console.log('=== Testing Worker with ComfyUI Integration ===\n')

  // Clear old jobs for clean test - use direct Redis delete
  await clearRedisQueue()
  console.log('Cleared old jobs from Redis\n')

  // Start worker in this process
  console.log('Starting worker...\n')
  startWorker(1)

  // Wait for worker to be ready
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Add a test image job
  console.log('Adding image generation job...\n')
  const { id, type } = await addGenerateJob({
    type: 'image',
    projectId: 'test-project-1',
    userId: 'test-user-1',
    sceneId: 'scene-1',
    prompt: '一个美丽的古代宫殿，阳光透过窗户照进来，金色的光芒洒落在地板上',
    negativePrompt: 'blurry, distorted, low quality',
    width: 1024,
    height: 768,
  })

  console.log(`Added job: ${id} (type: ${type})\n`)

  // Wait for job to complete (with timeout)
  // Image generation takes ~30 seconds, so wait longer
  const maxWait = 180000 // 3 minutes
  const startTime = Date.now()
  let status
  let lastState = ''

  while (Date.now() - startTime < maxWait) {
    status = await getJobStatus(id)

    // Print status if changed
    if (status?.state !== lastState) {
      console.log(`Job ${id} state changed: ${lastState} -> ${status?.state}`)
      lastState = status?.state || ''
    }

    if (status?.state === 'completed' || status?.state === 'failed') {
      break
    }

    // Show progress updates
    if (status?.state === 'active') {
      process.stdout.write(`\rJob ${id} progress: ${status?.progress}%   `)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }
  console.log('') // New line after progress

  console.log('\n=== Final Job Status ===')
  console.log(JSON.stringify(status, null, 2))

  // Cleanup
  console.log('\nStopping worker...')
  await stopWorker()
  await connection.quit()

  console.log('\nTest complete!')
  process.exit(status?.result?.success ? 0 : 1)
}

testWorker().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
