// Add jobs to queue
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { addGenerateJob, type GenerateJobData } from '@/lib/queue'

// POST /api/queue/jobs - Add a new generation job
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.type || !body.projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, projectId' },
        { status: 400 }
      )
    }

    // Add userId from session
    const jobData: GenerateJobData = {
      ...body,
      userId: session.user.id,
    }

    // Type-specific validation
    switch (jobData.type) {
      case 'image':
        if (!jobData.sceneId || !jobData.prompt) {
          return NextResponse.json(
            { error: 'Image job requires sceneId and prompt' },
            { status: 400 }
          )
        }
        break
      case 'video':
        if (!jobData.sceneId || !jobData.imageUrl) {
          return NextResponse.json(
            { error: 'Video job requires sceneId and imageUrl' },
            { status: 400 }
          )
        }
        break
      case 'voice':
        if (!jobData.sceneId || !jobData.text || !jobData.voiceId) {
          return NextResponse.json(
            { error: 'Voice job requires sceneId, text, and voiceId' },
            { status: 400 }
          )
        }
        break
      case 'music':
        if (!jobData.prompt || !jobData.duration) {
          return NextResponse.json(
            { error: 'Music job requires prompt and duration' },
            { status: 400 }
          )
        }
        break
      case 'composite':
        if (!jobData.sceneIds || jobData.sceneIds.length === 0) {
          return NextResponse.json(
            { error: 'Composite job requires sceneIds array' },
            { status: 400 }
          )
        }
        break
      default:
        return NextResponse.json(
          { error: `Unknown job type: ${(jobData as GenerateJobData).type}` },
          { status: 400 }
        )
    }

    const { id, type } = await addGenerateJob(jobData, {
      priority: body.priority,
    })

    return NextResponse.json({
      success: true,
      jobId: id,
      type,
    })
  } catch (error) {
    console.error('Add job error:', error)
    return NextResponse.json(
      { error: 'Failed to add job to queue' },
      { status: 500 }
    )
  }
}
