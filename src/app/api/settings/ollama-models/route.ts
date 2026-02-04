import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// GET - Fetch available models from Ollama
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl');

    if (!baseUrl) {
      return NextResponse.json({ error: '缺少 baseUrl 参数' }, { status: 400 });
    }

    // Fetch models from Ollama API
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: '无法连接到 Ollama 服务' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const models = data.models?.map((m: { name: string; size: number; modified_at: string }) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    })) || [];

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error);
    return NextResponse.json(
      { error: '获取模型列表失败，请确保 Ollama 服务已启动' },
      { status: 500 }
    );
  }
}
