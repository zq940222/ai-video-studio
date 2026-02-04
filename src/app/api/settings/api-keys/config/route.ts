import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { AI_PROVIDERS } from '@/lib/providers';

// PATCH - Update provider config (e.g., model selection)
export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { provider, config } = await request.json();

    if (!provider || !(provider in AI_PROVIDERS)) {
      return NextResponse.json({ error: '无效的服务提供商' }, { status: 400 });
    }

    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, provider)
      ),
    });

    if (!existingKey) {
      return NextResponse.json({ error: '请先配置该服务' }, { status: 404 });
    }

    // Merge with existing config
    const newConfig = {
      ...(existingKey.config as Record<string, unknown> || {}),
      ...config,
    };

    await db
      .update(userApiKeys)
      .set({
        config: newConfig,
        updatedAt: new Date(),
      })
      .where(eq(userApiKeys.id, existingKey.id));

    return NextResponse.json({ message: '配置已更新', config: newConfig });
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: '更新配置失败' }, { status: 500 });
  }
}
