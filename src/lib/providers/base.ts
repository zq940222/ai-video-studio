// AI Provider Base Types and Interfaces

export type ProviderType = 'llm' | 'image' | 'video' | 'voice' | 'music';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TaskResult<T = unknown> {
  status: TaskStatus;
  data?: T;
  error?: string;
  progress?: number;
}

// LLM Types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMInput {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMOutput {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Image Types
export interface ImageInput {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  referenceImage?: string; // Base64 or URL
  style?: string;
}

export interface ImageOutput {
  url: string;
  width: number;
  height: number;
}

// Video Types
export interface VideoInput {
  prompt?: string;
  image?: string; // Base64 or URL for image-to-video
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface VideoOutput {
  url: string;
  duration: number;
  width: number;
  height: number;
}

// Voice Types
export interface VoiceInput {
  text: string;
  voiceId: string;
  speed?: number;
  pitch?: number;
}

export interface VoiceOutput {
  url: string;
  duration: number;
}

// Music Types
export interface MusicInput {
  prompt: string;
  duration?: number;
  style?: string;
  instrumental?: boolean;
}

export interface MusicOutput {
  url: string;
  duration: number;
}

// Provider Input/Output Type Maps
export interface ProviderInputMap {
  llm: LLMInput;
  image: ImageInput;
  video: VideoInput;
  voice: VoiceInput;
  music: MusicInput;
}

export interface ProviderOutputMap {
  llm: LLMOutput;
  image: ImageOutput;
  video: VideoOutput;
  voice: VoiceOutput;
  music: MusicOutput;
}

// Base Provider Interface
export interface AIProvider<T extends ProviderType> {
  name: string;
  type: T;

  // Check if the provider is available (API key configured, etc.)
  isAvailable(): Promise<boolean>;

  // Generate content
  generate(input: ProviderInputMap[T]): Promise<ProviderOutputMap[T]>;

  // For async providers, check task status
  checkStatus?(taskId: string): Promise<TaskResult<ProviderOutputMap[T]>>;
}

// LLM Provider with streaming support
export interface LLMProvider extends AIProvider<'llm'> {
  generateStream?(
    input: LLMInput,
    onChunk: (chunk: string) => void
  ): Promise<LLMOutput>;
}
