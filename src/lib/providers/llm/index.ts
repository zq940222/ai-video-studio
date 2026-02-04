import { LLMProvider } from '../base';
import { OpenAIProvider } from './openai';
import { QwenProvider } from './qwen';
import { getUserApiKey } from '@/lib/api-keys';

export type LLMProviderId = 'openai' | 'anthropic' | 'qwen';

/**
 * Get an LLM provider instance for a user
 */
export async function getLLMProvider(
  userId: string,
  providerId: LLMProviderId
): Promise<LLMProvider | null> {
  const apiKey = await getUserApiKey(userId, providerId);
  if (!apiKey) {
    return null;
  }

  switch (providerId) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'qwen':
      return new QwenProvider(apiKey);
    case 'anthropic':
      // Anthropic uses OpenAI-compatible format with different base URL
      return new OpenAIProvider(apiKey, {
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-haiku-20240307',
      });
    default:
      return null;
  }
}

/**
 * Get any available LLM provider for a user
 * Tries providers in order of preference
 */
export async function getAvailableLLMProvider(
  userId: string
): Promise<{ provider: LLMProvider; providerId: LLMProviderId } | null> {
  const providerOrder: LLMProviderId[] = ['qwen', 'openai', 'anthropic'];

  for (const providerId of providerOrder) {
    const provider = await getLLMProvider(userId, providerId);
    if (provider && (await provider.isAvailable())) {
      return { provider, providerId };
    }
  }

  return null;
}

export { OpenAIProvider, QwenProvider };
