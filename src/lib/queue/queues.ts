// BullMQ Queue definitions
import { Queue, QueueEvents } from 'bullmq'
import { connection } from './connection'
import type { GenerateJobData, JobResult } from './types'

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
}

// Main generation queue - handles all AI generation tasks
export const generateQueue = new Queue<GenerateJobData, JobResult>('generate', {
  connection,
  defaultJobOptions,
})

// Queue events for monitoring
export const generateQueueEvents = new QueueEvents('generate', { connection })

// Helper to add jobs with proper typing
export async function addGenerateJob(
  data: GenerateJobData,
  options?: {
    priority?: number
    delay?: number
    jobId?: string
  }
) {
  const job = await generateQueue.add(data.type, data, {
    priority: options?.priority ?? data.priority ?? 3,
    delay: options?.delay,
    jobId: options?.jobId,
  })

  return {
    id: job.id!,
    type: data.type,
  }
}

// Get job by ID
export async function getJobStatus(jobId: string) {
  const job = await generateQueue.getJob(jobId)
  if (!job) return null

  const state = await job.getState()

  return {
    id: job.id!,
    type: job.data.type,
    state,
    progress: job.progress as number,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    createdAt: new Date(job.timestamp),
    processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
  }
}

// Get all jobs for a project
export async function getProjectJobs(projectId: string) {
  const jobs = await generateQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
  const projectJobs = jobs.filter(job => job.data.projectId === projectId)
  return Promise.all(
    projectJobs.map(async job => ({
      id: job.id!,
      type: job.data.type,
      state: await job.getState(),
      progress: job.progress as number,
    }))
  )
}

// Cancel a job
export async function cancelJob(jobId: string) {
  const job = await generateQueue.getJob(jobId)
  if (!job) return false

  const state = await job.getState()
  if (state === 'waiting' || state === 'delayed') {
    await job.remove()
    return true
  }

  return false
}

// Pause/Resume queue (for maintenance)
export async function pauseQueue() {
  await generateQueue.pause()
}

export async function resumeQueue() {
  await generateQueue.resume()
}

// Clean old jobs
export async function cleanOldJobs() {
  await generateQueue.clean(24 * 3600 * 1000, 1000, 'completed')
  await generateQueue.clean(7 * 24 * 3600 * 1000, 100, 'failed')
}
