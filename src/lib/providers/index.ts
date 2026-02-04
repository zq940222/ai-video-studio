// Auth types supported by providers
export type AuthType = 'api_key' | 'oauth';

export interface ProviderConfig {
  name: string;
  type: 'llm' | 'image' | 'video' | 'voice' | 'music';
  description: string;
  placeholder?: string;
  isLocal?: boolean;
  authTypes: AuthType[]; // Supported auth methods
  oauth?: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdEnvVar: string; // Env var name for client ID
    clientSecretEnvVar: string; // Env var name for client secret
  };
}

// Supported AI providers configuration
export const AI_PROVIDERS: Record<string, ProviderConfig> = {
  // LLM Providers
  ollama: {
    name: 'Ollama',
    type: 'llm',
    description: '本地部署，支持 Llama/Qwen/Mistral 等开源模型',
    placeholder: 'http://localhost:11434',
    isLocal: true,
    authTypes: ['api_key'],
  },
  openai: {
    name: 'OpenAI',
    type: 'llm',
    description: 'GPT-4, GPT-3.5 等模型',
    placeholder: 'sk-...',
    authTypes: ['api_key'],
  },
  anthropic: {
    name: 'Anthropic',
    type: 'llm',
    description: 'Claude 系列模型',
    placeholder: 'sk-ant-...',
    authTypes: ['api_key'],
  },
  gemini: {
    name: 'Google Gemini',
    type: 'llm',
    description: 'Gemini Pro, Gemini Ultra 等模型',
    placeholder: 'AIza...',
    authTypes: ['api_key', 'oauth'],
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/generative-language.retriever',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
      clientIdEnvVar: 'GOOGLE_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_OAUTH_CLIENT_SECRET',
    },
  },
  qwen: {
    name: '通义千问',
    type: 'llm',
    description: '阿里云通义千问',
    placeholder: 'sk-...',
    authTypes: ['api_key', 'oauth'],
    oauth: {
      authUrl: 'https://oauth.aliyun.com/authorize',
      tokenUrl: 'https://oauth.aliyun.com/token',
      scopes: ['openid', 'profile'],
      clientIdEnvVar: 'QWEN_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'QWEN_OAUTH_CLIENT_SECRET',
    },
  },

  // Image Providers
  comfyui: {
    name: 'ComfyUI',
    type: 'image',
    description: '本地部署，支持 FLUX/SD',
    placeholder: 'http://localhost:8188',
    isLocal: true,
    authTypes: ['api_key'], // Just endpoint URL
  },
  nanobanana: {
    name: 'NanoBanana',
    type: 'image',
    description: 'NanoBanana GPU 云平台，支持 FLUX/SD',
    placeholder: 'your-api-key',
    authTypes: ['api_key', 'oauth'],
    oauth: {
      authUrl: 'https://nanobanana.com/oauth/authorize',
      tokenUrl: 'https://nanobanana.com/oauth/token',
      scopes: ['images.generate', 'models.read'],
      clientIdEnvVar: 'NANOBANANA_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'NANOBANANA_OAUTH_CLIENT_SECRET',
    },
  },

  // Video Providers
  'comfyui-video': {
    name: 'ComfyUI Video',
    type: 'video',
    description: '本地部署，支持 Wan2.1/AnimateDiff',
    placeholder: 'http://localhost:8188',
    isLocal: true,
    authTypes: ['api_key'], // Just endpoint URL
  },
  kling: {
    name: '可灵',
    type: 'video',
    description: '快手可灵视频生成',
    placeholder: 'your-api-key',
    authTypes: ['api_key', 'oauth'],
    oauth: {
      authUrl: 'https://open.kuaishou.com/oauth2/authorize',
      tokenUrl: 'https://open.kuaishou.com/oauth2/token',
      scopes: ['video.generate'],
      clientIdEnvVar: 'KLING_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'KLING_OAUTH_CLIENT_SECRET',
    },
  },
  runway: {
    name: 'Runway',
    type: 'video',
    description: 'Runway Gen-2/Gen-3',
    placeholder: 'your-api-key',
    authTypes: ['api_key'],
  },
  jimeng: {
    name: '即梦',
    type: 'video',
    description: '字节跳动即梦',
    placeholder: 'your-api-key',
    authTypes: ['api_key', 'oauth'],
    oauth: {
      authUrl: 'https://open.douyin.com/platform/oauth/connect',
      tokenUrl: 'https://open.douyin.com/oauth/access_token',
      scopes: ['video.create'],
      clientIdEnvVar: 'JIMENG_OAUTH_CLIENT_ID',
      clientSecretEnvVar: 'JIMENG_OAUTH_CLIENT_SECRET',
    },
  },

  // Voice Providers
  'comfyui-voice': {
    name: 'ComfyUI Voice',
    type: 'voice',
    description: '本地部署，支持 Qwen3-TTS/MegaTTS3',
    placeholder: 'http://localhost:8188',
    isLocal: true,
    authTypes: ['api_key'],
  },
  elevenlabs: {
    name: 'ElevenLabs',
    type: 'voice',
    description: '高质量 AI 配音',
    placeholder: 'your-api-key',
    authTypes: ['api_key'],
  },
  xunfei: {
    name: '讯飞',
    type: 'voice',
    description: '讯飞语音合成',
    placeholder: 'your-api-key',
    authTypes: ['api_key'],
  },

  // Music Providers
  'comfyui-music': {
    name: 'ComfyUI Music',
    type: 'music',
    description: '本地部署，支持 ACE-Step/Stable Audio',
    placeholder: 'http://localhost:8188',
    isLocal: true,
    authTypes: ['api_key'],
  },
  suno: {
    name: 'Suno',
    type: 'music',
    description: 'AI 音乐生成',
    placeholder: 'your-api-key',
    authTypes: ['api_key'],
  },
};

export type ProviderId = keyof typeof AI_PROVIDERS;
export type ProviderType = 'llm' | 'image' | 'video' | 'voice' | 'music';

export function getProvidersByType(type: ProviderType) {
  return Object.entries(AI_PROVIDERS)
    .filter(([, config]) => config.type === type)
    .map(([id, config]) => ({ id, ...config }));
}
