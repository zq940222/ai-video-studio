import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto';
import { AI_PROVIDERS, ProviderId } from '@/lib/providers';

// GET - List all API keys for the current user (masked)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const keys = await db.query.userApiKeys.findMany({
      where: eq(userApiKeys.userId, session.user.id),
    });

    // Return masked keys with provider info
    const maskedKeys = keys.map((key) => {
      const decryptedKey = decrypt(key.encryptedKey);
      return {
        id: key.id,
        provider: key.provider,
        maskedKey: maskApiKey(decryptedKey),
        updatedAt: key.updatedAt,
      };
    });

    return NextResponse.json(maskedKeys);
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: '获取 API Key 失败' }, { status: 500 });
  }
}

// POST - Add or update an API key
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();

    // Validate provider
    if (!provider || !(provider in AI_PROVIDERS)) {
      return NextResponse.json({ error: '无效的服务提供商' }, { status: 400 });
    }

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    const encryptedKey = encrypt(apiKey.trim());

    // Check if key already exists for this provider
    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, provider)
      ),
    });

    if (existingKey) {
      // Update existing key
      await db
        .update(userApiKeys)
        .set({
          encryptedKey,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, existingKey.id));

      return NextResponse.json({ message: 'API Key 已更新' });
    } else {
      // Insert new key
      await db.insert(userApiKeys).values({
        userId: session.user.id,
        provider,
        encryptedKey,
      });

      return NextResponse.json({ message: 'API Key 已保存' }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to save API key:', error);
    return NextResponse.json({ error: '保存 API Key 失败' }, { status: 500 });
  }
}

// DELETE - Remove an API key
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ProviderId;

    if (!provider) {
      return NextResponse.json({ error: '缺少 provider 参数' }, { status: 400 });
    }

    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, provider)
        )
      );

    return NextResponse.json({ message: 'API Key 已删除' });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: '删除 API Key 失败' }, { status: 500 });
  }
}
