// Test script for queue
import { addGenerateJob, getJobStatus, generateQueue } from '../src/lib/queue'

async function testQueue() {
  console.log('Testing BullMQ queue...\n')

  // Add a test image job
  const { id, type } = await addGenerateJob({
    type: 'image',
    projectId: 'test-project-1',
    userId: 'test-user-1',
    sceneId: 'scene-1',
    prompt: '一个美丽的古代宫殿，阳光透过窗户照进来',
    width: 1024,
    height: 768,
  })

  console.log(`Added job: ${id} (type: ${type})`)

  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Check status
  const status = await getJobStatus(id)
  console.log('\nJob status:', JSON.stringify(status, null, 2))

  // Get queue stats
  const [waiting, active, completed, failed] = await Promise.all([
    generateQueue.getWaitingCount(),
    generateQueue.getActiveCount(),
    generateQueue.getCompletedCount(),
    generateQueue.getFailedCount(),
  ])

  console.log('\nQueue stats:', { waiting, active, completed, failed })

  process.exit(0)
}

testQueue().catch(console.error)
