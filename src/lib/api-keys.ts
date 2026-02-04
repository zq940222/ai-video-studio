import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';
import { ProviderId, AI_PROVIDERS } from '@/lib/providers';

export interface ProviderConfig {
  model?: string;
  [key: string]: unknown;
}

export type AuthCredentials = {
  type: 'api_key';
  apiKey: string;
  config?: ProviderConfig;
} | {
  type: 'oauth';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  config?: ProviderConfig;
};

/**
 * Get decrypted API key for a specific provider and user
 */
export async function getUserApiKey(
  userId: string,
  provider: ProviderId
): Promise<string | null> {
  const credentials = await getUserCredentials(userId, provider);
  if (!credentials) return null;

  if (credentials.type === 'api_key') {
    return credentials.apiKey;
  } else {
    return credentials.accessToken;
  }
}

/**
 * Get full credentials (API key or OAuth tokens) for a provider
 */
export async function getUserCredentials(
  userId: string,
  provider: ProviderId
): Promise<AuthCredentials | null> {
  const key = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.provider, provider)
    ),
  });

  if (!key) {
    return null;
  }

  try {
    const authType = key.authType || 'api_key';
    const config = key.config as ProviderConfig | null;

    if (authType === 'oauth') {
      if (!key.encryptedAccessToken) {
        return null;
      }

      // Check if token needs refresh
      if (key.tokenExpiresAt && key.tokenExpiresAt < new Date()) {
        const refreshed = await refreshOAuthToken(userId, provider, key);
        if (refreshed) {
          return refreshed;
        }
        return null;
      }

      return {
        type: 'oauth',
        accessToken: decrypt(key.encryptedAccessToken),
        refreshToken: key.encryptedRefreshToken ? decrypt(key.encryptedRefreshToken) : undefined,
        expiresAt: key.tokenExpiresAt || undefined,
        config: config || undefined,
      };
    } else {
      if (!key.encryptedKey) {
        return null;
      }

      let apiKey: string;
      // Check if it's a plain URL (local provider, stored with 'url:' prefix)
      if (key.encryptedKey.startsWith('url:')) {
        apiKey = key.encryptedKey.slice(4); // Remove 'url:' prefix
        console.log(`[API Keys] Provider ${provider}: Using plain URL`);
      } else {
        // Decrypt API key
        console.log(`[API Keys] Provider ${provider}: Decrypting key, prefix:`, key.encryptedKey.substring(0, 10));
        apiKey = decrypt(key.encryptedKey);
      }

      console.log(`[API Keys] Provider ${provider}: Retrieved apiKey starts with:`, apiKey.substring(0, 20));

      return {
        type: 'api_key',
        apiKey,
        config: config || undefined,
      };
    }
  } catch (error) {
    console.error(`Failed to decrypt credentials for provider ${provider}:`, error);
    return null;
  }
}

/**
 * Refresh OAuth token if expired
 */
async function refreshOAuthToken(
  userId: string,
  provider: ProviderId,
  key: typeof userApiKeys.$inferSelect
): Promise<AuthCredentials | null> {
  if (!key.encryptedRefreshToken) {
    return null;
  }

  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig?.oauth) {
    return null;
  }

  const oauth = providerConfig.oauth;
  const clientId = process.env[oauth.clientIdEnvVar];
  const clientSecret = process.env[oauth.clientSecretEnvVar];

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const refreshToken = decrypt(key.encryptedRefreshToken);

    const response = await fetch(oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed');
      return null;
    }

    const tokenData = await response.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return null;
    }

    // Update tokens in database
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : key.encryptedRefreshToken;
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    await db
      .update(userApiKeys)
      .set({
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        oauthMetadata: tokenData,
        updatedAt: new Date(),
      })
      .where(eq(userApiKeys.id, key.id));

    return {
      type: 'oauth',
      accessToken: access_token,
      refreshToken: refresh_token || refreshToken,
      expiresAt: tokenExpiresAt || undefined,
    };
  } catch (error) {
    console.error('Failed to refresh OAuth token:', error);
    return null;
  }
}

/**
 * Get all configured providers for a user
 */
export async function getUserConfiguredProviders(
  userId: string
): Promise<ProviderId[]> {
  const keys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, userId),
    columns: { provider: true },
  });

  return keys.map((k) => k.provider as ProviderId);
}

/**
 * Check if a user has configured a specific provider
 */
export async function hasUserConfiguredProvider(
  userId: string,
  provider: ProviderId
): Promise<boolean> {
  const key = await db.query.userApiKeys.findFirst({
    where: and(
      eq(userApiKeys.userId, userId),
      eq(userApiKeys.provider, provider)
    ),
    columns: { id: true },
  });

  return !!key;
}
