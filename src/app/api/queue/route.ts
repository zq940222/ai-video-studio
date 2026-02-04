// Queue status and management API
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateQueue, getJobStatus, getProjectJobs, cancelJob } from '@/lib/queue'

// GET /api/queue - Get queue stats
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get('jobId')
  const projectId = searchParams.get('projectId')

  try {
    // Get specific job status
    if (jobId) {
      const status = await getJobStatus(jobId)
      if (!status) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json(status)
    }

    // Get all jobs for a project
    if (projectId) {
      const jobs = await getProjectJobs(projectId)
      return NextResponse.json({ jobs })
    }

    // Get queue stats
    const [waiting, active, completed, failed] = await Promise.all([
      generateQueue.getWaitingCount(),
      generateQueue.getActiveCount(),
      generateQueue.getCompletedCount(),
      generateQueue.getFailedCount(),
    ])

    return NextResponse.json({
      stats: { waiting, active, completed, failed },
      isPaused: await generateQueue.isPaused(),
    })
  } catch (error) {
    console.error('Queue API error:', error)
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    )
  }
}

// DELETE /api/queue?jobId=xxx - Cancel a job
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
  }

  try {
    const cancelled = await cancelJob(jobId)
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Cannot cancel job (already processing or completed)' },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel job error:', error)
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 })
  }
}
