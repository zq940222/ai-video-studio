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
      const authType = key.authType || 'api_key';
      const config = key.config as Record<string, unknown> | null;

      if (authType === 'oauth') {
        return {
          id: key.id,
          provider: key.provider,
          authType: 'oauth' as const,
          oauthConnected: !!key.encryptedAccessToken,
          tokenExpiresAt: key.tokenExpiresAt?.toISOString(),
          config,
          updatedAt: key.updatedAt,
        };
      } else {
        let decryptedKey = '';
        if (key.encryptedKey) {
          // Check if it's a plain URL (local provider)
          if (key.encryptedKey.startsWith('url:')) {
            decryptedKey = key.encryptedKey.slice(4); // Remove 'url:' prefix
          } else {
            // Decrypt API key
            try {
              decryptedKey = decrypt(key.encryptedKey);
            } catch {
              decryptedKey = '[解密失败]';
            }
          }
        }
        return {
          id: key.id,
          provider: key.provider,
          authType: 'api_key' as const,
          maskedKey: maskApiKey(decryptedKey),
          config,
          updatedAt: key.updatedAt,
        };
      }
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

    const body = await request.json();
    const { provider, apiKey, authType = 'api_key', config } = body;

    console.log('[API Keys] POST request:', {
      provider,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      authType,
      config,
      userId: session.user.id,
    });

    // Validate provider
    if (!provider || !(provider in AI_PROVIDERS)) {
      return NextResponse.json({ error: '无效的服务提供商' }, { status: 400 });
    }

    if (authType === 'api_key' && !apiKey?.trim()) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    // Check if this is a local provider (no encryption needed for URLs)
    const isLocalProvider = AI_PROVIDERS[provider as ProviderId]?.isLocal;
    let encryptedKey: string | null = null;

    if (apiKey) {
      if (isLocalProvider) {
        // For local providers, store URL directly (no encryption needed)
        // Use a prefix to indicate it's a plain URL
        encryptedKey = `url:${apiKey.trim()}`;
        console.log('[API Keys] Storing local service URL (no encryption)');
      } else {
        // For cloud providers, encrypt the API key
        try {
          encryptedKey = encrypt(apiKey.trim());
          console.log('[API Keys] Encryption successful');
        } catch (encryptError) {
          console.error('[API Keys] Encryption failed:', encryptError);
          return NextResponse.json(
            { error: '加密失败，请检查服务器 ENCRYPTION_KEY 配置' },
            { status: 500 }
          );
        }
      }
    }

    // Check if key already exists for this provider
    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, provider)
      ),
    });

    if (existingKey) {
      // Update existing key
      console.log('[API Keys] Updating existing key for provider:', provider);
      await db
        .update(userApiKeys)
        .set({
          authType: 'api_key',
          encryptedKey,
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          oauthMetadata: null,
          config: config || existingKey.config,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, existingKey.id));

      console.log('[API Keys] Update successful');
      return NextResponse.json({ message: 'API Key 已更新' });
    } else {
      // Insert new key
      console.log('[API Keys] Inserting new key for provider:', provider);
      await db.insert(userApiKeys).values({
        userId: session.user.id,
        provider,
        config,
        authType: 'api_key',
        encryptedKey,
      });

      console.log('[API Keys] Insert successful');
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
