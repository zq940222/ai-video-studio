import { AIProvider } from '../base';
import { ComfyUIVoiceProvider, VOICE_STYLES } from './comfyui';

export type VoiceStyleId = keyof typeof VOICE_STYLES;

// Voice provider instances
const comfyuiProvider = new ComfyUIVoiceProvider(
  process.env.COMFYUI_URL || 'http://localhost:8188'
);

// Provider registry
const voiceProviders: Record<string, AIProvider<'voice'>> = {
  comfyui: comfyuiProvider,
};

export async function getAvailableVoiceProvider(
  userId: string
): Promise<{ provider: AIProvider<'voice'>; providerId: string } | null> {
  // Try ComfyUI first (local, no API key needed)
  if (await comfyuiProvider.isAvailable()) {
    return { provider: comfyuiProvider, providerId: 'comfyui' };
  }

  // TODO: Add cloud TTS providers (ElevenLabs, Azure, etc.) with API key check

  return null;
}

export function getVoiceProvider(providerId: string): AIProvider<'voice'> | null {
  return voiceProviders[providerId] || null;
}

export function getVoiceStyles() {
  return VOICE_STYLES;
}

export { ComfyUIVoiceProvider, VOICE_STYLES };
