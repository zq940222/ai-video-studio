import { AIProvider, MusicInput, MusicOutput, TaskResult } from '../base';

interface ComfyUIWorkflow {
  [key: string]: {
    class_type: string;
    inputs: Record<string, unknown>;
  };
}

interface QueueResponse {
  prompt_id: string;
}

interface HistoryResponse {
  [promptId: string]: {
    status: {
      status_str: string;
      completed: boolean;
    };
    outputs: {
      [nodeId: string]: {
        audio?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

// Music style presets
export const MUSIC_STYLES = {
  'cinematic-epic': { name: '史诗电影', description: '气势恢宏的史诗配乐' },
  'cinematic-emotional': { name: '情感电影', description: '感人的情感配乐' },
  'cinematic-tension': { name: '紧张悬疑', description: '紧张刺激的悬疑配乐' },
  'ambient-peaceful': { name: '平静氛围', description: '安静祥和的背景音乐' },
  'ambient-dark': { name: '黑暗氛围', description: '阴暗神秘的氛围音乐' },
  'electronic-upbeat': { name: '电子节拍', description: '充满活力的电子音乐' },
  'classical-piano': { name: '钢琴独奏', description: '优雅的钢琴独奏' },
  'orchestral-drama': { name: '交响戏剧', description: '戏剧性的交响乐' },
} as const;

export type MusicStyleId = keyof typeof MUSIC_STYLES;

export class ComfyUIMusicProvider implements AIProvider<'music'> {
  name = 'ComfyUI-ACEStep';
  type = 'music' as const;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8188') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(input: MusicInput): Promise<MusicOutput> {
    const workflow = this.buildMusicWorkflow(input);

    // Queue the prompt
    const queueResponse = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResponse.ok) {
      const error = await queueResponse.text();
      throw new Error(`ComfyUI queue error: ${error}`);
    }

    const { prompt_id } = (await queueResponse.json()) as QueueResponse;

    // Poll for completion
    const result = await this.waitForCompletion(prompt_id);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Music generation failed');
    }

    return result.data!;
  }

  async checkStatus(promptId: string): Promise<TaskResult<MusicOutput>> {
    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);

      if (!response.ok) {
        return { status: 'processing' };
      }

      const history = (await response.json()) as HistoryResponse;
      const promptHistory = history[promptId];

      if (!promptHistory) {
        return { status: 'processing' };
      }

      if (!promptHistory.status.completed) {
        return { status: 'processing' };
      }

      // Find the output audio
      for (const nodeOutput of Object.values(promptHistory.outputs)) {
        if (nodeOutput.audio && nodeOutput.audio.length > 0) {
          const audio = nodeOutput.audio[0];
          const audioUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(audio.filename)}&subfolder=${encodeURIComponent(audio.subfolder)}&type=${encodeURIComponent(audio.type)}`;

          return {
            status: 'completed',
            data: {
              url: audioUrl,
              duration: 30, // Default, ACE-Step generates ~30s clips
            },
          };
        }
      }

      return { status: 'failed', error: 'No output audio found' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async waitForCompletion(
    promptId: string,
    maxWaitMs: number = 300000, // 5 minutes for music
    pollIntervalMs: number = 3000
  ): Promise<TaskResult<MusicOutput>> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkStatus(promptId);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'failed', error: 'Timeout waiting for music generation' };
  }

  private buildMusicWorkflow(input: MusicInput): ComfyUIWorkflow {
    const duration = input.duration || 30;
    const seed = Math.floor(Math.random() * 1000000000);

    // ACE-Step music generation workflow
    return {
      // Load ACE-Step model
      '1': {
        class_type: 'ACEStepLoader',
        inputs: {
          model_name: 'ace-step-v1',
        },
      },
      // Generate music
      '2': {
        class_type: 'ACEStepGenerate',
        inputs: {
          prompt: this.buildMusicPrompt(input),
          duration,
          seed,
          instrumental: input.instrumental !== false, // Default to instrumental
          model: ['1', 0],
        },
      },
      // Save audio
      '3': {
        class_type: 'SaveAudio',
        inputs: {
          filename_prefix: 'ai_video_studio_music',
          audio: ['2', 0],
        },
      },
    };
  }

  private buildMusicPrompt(input: MusicInput): string {
    let prompt = input.prompt;

    // Add style modifier if specified
    if (input.style && input.style in MUSIC_STYLES) {
      const styleInfo = MUSIC_STYLES[input.style as MusicStyleId];
      prompt = `${styleInfo.description}, ${prompt}`;
    }

    // Add instrumental tag if needed
    if (input.instrumental !== false) {
      prompt = `${prompt}, instrumental, no vocals`;
    }

    return prompt;
  }

  // Get available music styles
  getMusicStyles(): typeof MUSIC_STYLES {
    return MUSIC_STYLES;
  }
}
