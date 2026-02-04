import { AIProvider } from '../base';
import { ComfyUIMusicProvider, MUSIC_STYLES } from './comfyui';

export type MusicStyleId = keyof typeof MUSIC_STYLES;

// Music provider instances
const comfyuiProvider = new ComfyUIMusicProvider(
  process.env.COMFYUI_URL || 'http://localhost:8188'
);

// Provider registry
const musicProviders: Record<string, AIProvider<'music'>> = {
  comfyui: comfyuiProvider,
};

export async function getAvailableMusicProvider(
  userId: string
): Promise<{ provider: AIProvider<'music'>; providerId: string } | null> {
  // Try ComfyUI first (local, no API key needed)
  if (await comfyuiProvider.isAvailable()) {
    return { provider: comfyuiProvider, providerId: 'comfyui' };
  }

  // TODO: Add cloud music providers (Suno, Udio, etc.) with API key check

  return null;
}

export function getMusicProvider(providerId: string): AIProvider<'music'> | null {
  return musicProviders[providerId] || null;
}

export function getMusicStyles() {
  return MUSIC_STYLES;
}

export { ComfyUIMusicProvider, MUSIC_STYLES };
