import { db } from '@/lib/db';
import { userApiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { ProviderId } from '@/lib/providers';

/**
 * Get decrypted API key for a specific provider and user
 */
export async function getUserApiKey(
  userId: string,
  provider: ProviderId
): Promise<string | null> {
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
    return decrypt(key.encryptedKey);
  } catch (error) {
    console.error(`Failed to decrypt API key for provider ${provider}:`, error);
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
