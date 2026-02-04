import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// POST - Upload character reference image
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const characterName = formData.get('characterName') as string;

    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '请上传图片文件' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 });
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'characters', projectId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const filepath = join(uploadDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Return public URL
    const url = `/uploads/characters/${projectId}/${filename}`;

    return NextResponse.json({
      url,
      filename,
      characterName,
    });
  } catch (error) {
    console.error('Failed to upload character image:', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
