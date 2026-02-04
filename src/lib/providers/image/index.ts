import { AIProvider } from '../base';
import { ComfyUIProvider } from './comfyui';
import { getUserApiKey } from '@/lib/api-keys';

export type ImageProviderId = 'comfyui';

/**
 * Get an Image provider instance for a user
 */
export async function getImageProvider(
  userId: string,
  providerId: ImageProviderId
): Promise<AIProvider<'image'> | null> {
  switch (providerId) {
    case 'comfyui': {
      const comfyuiUrl = await getUserApiKey(userId, 'comfyui');
      // ComfyUI URL is stored as the "API key"
      const url = comfyuiUrl || process.env.COMFYUI_URL || 'http://localhost:8188';
      return new ComfyUIProvider(url);
    }
    default:
      return null;
  }
}

/**
 * Get any available Image provider for a user
 */
export async function getAvailableImageProvider(
  userId: string
): Promise<{ provider: AIProvider<'image'>; providerId: ImageProviderId } | null> {
  // Try ComfyUI first (local, preferred)
  const comfyui = await getImageProvider(userId, 'comfyui');
  if (comfyui && (await comfyui.isAvailable())) {
    return { provider: comfyui, providerId: 'comfyui' };
  }

  return null;
}

export { ComfyUIProvider };
