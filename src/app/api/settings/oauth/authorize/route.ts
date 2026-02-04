import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AI_PROVIDERS, ProviderId } from '@/lib/providers';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Generate OAuth authorization URL
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ProviderId;

    if (!provider || !(provider in AI_PROVIDERS)) {
      return NextResponse.json({ error: '无效的服务提供商' }, { status: 400 });
    }

    const providerConfig = AI_PROVIDERS[provider];

    if (!providerConfig.authTypes.includes('oauth') || !providerConfig.oauth) {
      return NextResponse.json({ error: '该服务不支持 OAuth 授权' }, { status: 400 });
    }

    const oauth = providerConfig.oauth;

    // Check if OAuth credentials are configured
    const clientId = process.env[oauth.clientIdEnvVar];
    if (!clientId) {
      return NextResponse.json(
        { error: `OAuth 未配置，请在环境变量中设置 ${oauth.clientIdEnvVar}` },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Build authorization URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/settings/oauth/callback`;

    const authUrl = new URL(oauth.authUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', oauth.scopes.join(' '));
    authUrl.searchParams.set('state', `${provider}:${state}`);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json({ error: '生成授权链接失败' }, { status: 500 });
  }
}
