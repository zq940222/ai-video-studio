import { AIProvider } from '../base';
import { ComfyUIVideoProvider } from './comfyui';

// Video provider instances
const comfyuiProvider = new ComfyUIVideoProvider(
  process.env.COMFYUI_URL || 'http://localhost:8188'
);

// Provider registry
const videoProviders: Record<string, AIProvider<'video'>> = {
  comfyui: comfyuiProvider,
};

export async function getAvailableVideoProvider(
  userId: string
): Promise<{ provider: AIProvider<'video'>; providerId: string } | null> {
  // Try ComfyUI first (local, no API key needed)
  if (await comfyuiProvider.isAvailable()) {
    return { provider: comfyuiProvider, providerId: 'comfyui' };
  }

  // TODO: Add cloud video providers (Kling, Runway, etc.) with API key check

  return null;
}

export function getVideoProvider(providerId: string): AIProvider<'video'> | null {
  return videoProviders[providerId] || null;
}

export { ComfyUIVideoProvider };
