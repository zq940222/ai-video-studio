// Supported AI providers configuration
export const AI_PROVIDERS = {
  // LLM Providers
  openai: {
    name: 'OpenAI',
    type: 'llm',
    description: 'GPT-4, GPT-3.5 等模型',
    placeholder: 'sk-...',
  },
  anthropic: {
    name: 'Anthropic',
    type: 'llm',
    description: 'Claude 系列模型',
    placeholder: 'sk-ant-...',
  },
  qwen: {
    name: '通义千问',
    type: 'llm',
    description: '阿里云通义千问',
    placeholder: 'sk-...',
  },

  // Image Providers
  comfyui: {
    name: 'ComfyUI',
    type: 'image',
    description: '本地部署，支持 FLUX/SD',
    placeholder: 'http://localhost:8188',
    isLocal: true,
  },

  // Video Providers
  kling: {
    name: '可灵',
    type: 'video',
    description: '快手可灵视频生成',
    placeholder: 'your-api-key',
  },
  runway: {
    name: 'Runway',
    type: 'video',
    description: 'Runway Gen-2/Gen-3',
    placeholder: 'your-api-key',
  },
  jimeng: {
    name: '即梦',
    type: 'video',
    description: '字节跳动即梦',
    placeholder: 'your-api-key',
  },

  // Voice Providers
  elevenlabs: {
    name: 'ElevenLabs',
    type: 'voice',
    description: '高质量 AI 配音',
    placeholder: 'your-api-key',
  },
  xunfei: {
    name: '讯飞',
    type: 'voice',
    description: '讯飞语音合成',
    placeholder: 'your-api-key',
  },

  // Music Providers
  suno: {
    name: 'Suno',
    type: 'music',
    description: 'AI 音乐生成',
    placeholder: 'your-api-key',
  },
} as const;

export type ProviderId = keyof typeof AI_PROVIDERS;
export type ProviderType = 'llm' | 'image' | 'video' | 'voice' | 'music';

export function getProvidersByType(type: ProviderType) {
  return Object.entries(AI_PROVIDERS)
    .filter(([, config]) => config.type === type)
    .map(([id, config]) => ({ id, ...config }));
}
