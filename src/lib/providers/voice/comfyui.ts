import { AIProvider, VoiceInput, VoiceOutput, TaskResult } from '../base';

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

// Predefined voice styles for Qwen3-TTS
export const VOICE_STYLES = {
  'male-narrator': { name: '男性旁白', description: '沉稳的男性旁白声音' },
  'female-narrator': { name: '女性旁白', description: '温柔的女性旁白声音' },
  'male-young': { name: '年轻男性', description: '活力的年轻男性声音' },
  'female-young': { name: '年轻女性', description: '清脆的年轻女性声音' },
  'male-mature': { name: '成熟男性', description: '稳重的成熟男性声音' },
  'female-mature': { name: '成熟女性', description: '知性的成熟女性声音' },
  'child-male': { name: '男童', description: '天真的男童声音' },
  'child-female': { name: '女童', description: '可爱的女童声音' },
} as const;

export type VoiceStyleId = keyof typeof VOICE_STYLES;

export class ComfyUIVoiceProvider implements AIProvider<'voice'> {
  name = 'ComfyUI-TTS';
  type = 'voice' as const;
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

  async generate(input: VoiceInput): Promise<VoiceOutput> {
    const workflow = this.buildTTSWorkflow(input);

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
      throw new Error(result.error || 'TTS generation failed');
    }

    return result.data!;
  }

  async checkStatus(promptId: string): Promise<TaskResult<VoiceOutput>> {
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
              duration: 0, // Would need to be extracted from audio file
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
    maxWaitMs: number = 120000,
    pollIntervalMs: number = 2000
  ): Promise<TaskResult<VoiceOutput>> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkStatus(promptId);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'failed', error: 'Timeout waiting for TTS generation' };
  }

  private buildTTSWorkflow(input: VoiceInput): ComfyUIWorkflow {
    const speed = input.speed || 1.0;

    // Qwen3-TTS workflow
    return {
      // Load TTS model
      '1': {
        class_type: 'Qwen3TTSLoader',
        inputs: {
          model_name: 'Qwen3-TTS',
        },
      },
      // Text input
      '2': {
        class_type: 'Qwen3TTSGenerate',
        inputs: {
          text: input.text,
          voice_style: input.voiceId || 'female-narrator',
          speed,
          model: ['1', 0],
        },
      },
      // Save audio
      '3': {
        class_type: 'SaveAudio',
        inputs: {
          filename_prefix: 'ai_video_studio_tts',
          audio: ['2', 0],
        },
      },
    };
  }

  // Get available voice styles
  getVoiceStyles(): typeof VOICE_STYLES {
    return VOICE_STYLES;
  }
}
