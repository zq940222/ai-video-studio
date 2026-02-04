import { LLMProvider } from '../base';
import { OpenAIProvider } from './openai';
import { QwenProvider } from './qwen';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { getUserCredentials } from '@/lib/api-keys';

export type LLMProviderId = 'ollama' | 'openai' | 'anthropic' | 'qwen' | 'gemini';

/**
 * Get an LLM provider instance for a user
 */
export async function getLLMProvider(
  userId: string,
  providerId: LLMProviderId
): Promise<LLMProvider | null> {
  const credentials = await getUserCredentials(userId, providerId);
  if (!credentials) {
    return null;
  }

  const apiKey = credentials.type === 'api_key' ? credentials.apiKey : credentials.accessToken;
  const model = credentials.config?.model;

  switch (providerId) {
    case 'ollama':
      // apiKey is actually the base URL for Ollama
      return new OllamaProvider(apiKey, { model: model || 'qwen2.5:7b' });
    case 'openai':
      return new OpenAIProvider(apiKey, { model });
    case 'qwen':
      return new QwenProvider(apiKey, { model });
    case 'gemini':
      return new GeminiProvider(apiKey, { model });
    case 'anthropic':
      // Anthropic uses OpenAI-compatible format with different base URL
      return new OpenAIProvider(apiKey, {
        baseUrl: 'https://api.anthropic.com/v1',
        model: model || 'claude-3-haiku-20240307',
      });
    default:
      return null;
  }
}

/**
 * Get any available LLM provider for a user
 * Tries providers in order of preference: local first, then cloud
 */
export async function getAvailableLLMProvider(
  userId: string
): Promise<{ provider: LLMProvider; providerId: LLMProviderId } | null> {
  // Prefer local providers first, then cloud providers
  const providerOrder: LLMProviderId[] = ['ollama', 'qwen', 'openai', 'gemini', 'anthropic'];

  for (const providerId of providerOrder) {
    const provider = await getLLMProvider(userId, providerId);
    if (provider && (await provider.isAvailable())) {
      return { provider, providerId };
    }
  }

  return null;
}

export { OpenAIProvider, QwenProvider, GeminiProvider, OllamaProvider };
