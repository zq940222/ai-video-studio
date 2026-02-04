import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';
import { AI_PROVIDERS, ProviderId } from '@/lib/providers';
import { cookies } from 'next/headers';

// Handle OAuth callback
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return renderCallbackPage({ success: false, error: '未登录', provider: '' });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return renderCallbackPage({ success: false, error: `授权被拒绝: ${error}`, provider: '' });
    }

    if (!code || !state) {
      return renderCallbackPage({ success: false, error: '缺少授权参数', provider: '' });
    }

    // Parse state to get provider
    const [provider, stateToken] = state.split(':');

    if (!provider || !(provider in AI_PROVIDERS)) {
      return renderCallbackPage({ success: false, error: '无效的服务提供商', provider: '' });
    }

    // Verify state token
    const cookieStore = await cookies();
    const savedState = cookieStore.get(`oauth_state_${provider}`)?.value;

    if (!savedState || savedState !== stateToken) {
      return renderCallbackPage({ success: false, error: '状态验证失败，请重试', provider });
    }

    // Clear state cookie
    cookieStore.delete(`oauth_state_${provider}`);

    const providerConfig = AI_PROVIDERS[provider as ProviderId];

    if (!providerConfig.oauth) {
      return renderCallbackPage({ success: false, error: '该服务不支持 OAuth', provider });
    }

    const oauth = providerConfig.oauth;
    const clientId = process.env[oauth.clientIdEnvVar];
    const clientSecret = process.env[oauth.clientSecretEnvVar];

    if (!clientId || !clientSecret) {
      return renderCallbackPage({ success: false, error: 'OAuth 配置不完整', provider });
    }

    // Exchange code for tokens
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/settings/oauth/callback`;

    const tokenResponse = await fetch(oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return renderCallbackPage({ success: false, error: '获取访问令牌失败', provider });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return renderCallbackPage({ success: false, error: '未获取到访问令牌', provider });
    }

    // Encrypt tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    // Save or update OAuth tokens in database
    const existingKey = await db.query.userApiKeys.findFirst({
      where: and(
        eq(userApiKeys.userId, session.user.id),
        eq(userApiKeys.provider, provider)
      ),
    });

    if (existingKey) {
      await db
        .update(userApiKeys)
        .set({
          authType: 'oauth',
          encryptedKey: null,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          oauthMetadata: tokenData,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, existingKey.id));
    } else {
      await db.insert(userApiKeys).values({
        userId: session.user.id,
        provider,
        authType: 'oauth',
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        oauthMetadata: tokenData,
      });
    }

    return renderCallbackPage({ success: true, provider });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return renderCallbackPage({ success: false, error: '授权处理失败', provider: '' });
  }
}

function renderCallbackPage(result: { success: boolean; error?: string; provider: string }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth 授权</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f172a;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    .message {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .submessage {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .error {
      color: #f87171;
    }
    .success {
      color: #4ade80;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${result.success ? '✓' : '✗'}</div>
    <div class="message ${result.success ? 'success' : 'error'}">
      ${result.success ? '授权成功！' : '授权失败'}
    </div>
    <div class="submessage">
      ${result.success ? '窗口将自动关闭...' : result.error}
    </div>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'oauth_callback',
        provider: '${result.provider}',
        success: ${result.success},
        error: ${result.error ? `'${result.error}'` : 'null'}
      }, '*');
      setTimeout(() => window.close(), 1500);
    }
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
