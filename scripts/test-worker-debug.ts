// Debug test - minimal worker test
import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

async function test() {
  console.log('=== Debug Worker Test ===\n')
  console.log(`Redis URL: ${REDIS_URL}`)

  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  })

  // Create queue
  const queue = new Queue('debug-test', { connection })
  await queue.obliterate({ force: true })
  console.log('Queue created and cleared')

  // Create worker with inline processor
  const worker = new Worker(
    'debug-test',
    async (job) => {
      console.log(`\n>>> WORKER PROCESSING JOB ${job.id} <<<`)
      console.log(`Job data:`, job.data)

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log(`>>> WORKER COMPLETED JOB ${job.id} <<<\n`)
      return { success: true, message: 'Hello from worker!' }
    },
    { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) }
  )

  worker.on('completed', (job, result) => {
    console.log(`Event: Job ${job.id} completed with result:`, result)
  })

  worker.on('failed', (job, err) => {
    console.log(`Event: Job ${job?.id} failed:`, err.message)
  })

  console.log('Worker started')

  // Wait for worker to be ready
  await new Promise(resolve => setTimeout(resolve, 500))

  // Add a job
  console.log('\nAdding job...')
  const job = await queue.add('test', { hello: 'world' })
  console.log(`Job added: ${job.id}`)

  // Wait for completion
  console.log('Waiting for job to complete...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Check job status
  const completedJob = await queue.getJob(job.id!)
  console.log('\nFinal job state:', await completedJob?.getState())
  console.log('Job result:', completedJob?.returnvalue)

  // Cleanup
  await worker.close()
  await queue.close()
  await connection.quit()

  console.log('\nTest complete!')
}

test().catch(console.error)
