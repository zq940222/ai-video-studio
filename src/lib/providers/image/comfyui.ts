import { AIProvider, ImageInput, ImageOutput, TaskResult } from '../base';

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
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

// Default model configurations
export interface ComfyUIImageConfig {
  checkpointName?: string; // e.g., 'sd_xl_base_1.0.safetensors'
  samplerName?: string;    // e.g., 'euler', 'dpmpp_2m'
  scheduler?: string;      // e.g., 'normal', 'karras'
  steps?: number;
  cfg?: number;
}

// Get default config with environment variables (evaluated at runtime)
function getDefaultConfig(): ComfyUIImageConfig {
  return {
    checkpointName: process.env.COMFYUI_CHECKPOINT || 'AnythingXL_xl.safetensors',
    samplerName: 'euler',
    scheduler: 'normal',
    steps: 20,
    cfg: 7,
  };
}

export class ComfyUIProvider implements AIProvider<'image'> {
  name = 'ComfyUI';
  type = 'image' as const;
  private baseUrl: string;
  private config: ComfyUIImageConfig;

  constructor(baseUrl: string = 'http://localhost:8188', config?: ComfyUIImageConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.config = { ...getDefaultConfig(), ...config };
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

  async generate(input: ImageInput): Promise<ImageOutput> {
    // Build workflow for text-to-image
    const workflow = this.buildTextToImageWorkflow(input);

    console.log(`[ComfyUI] Submitting workflow with checkpoint: ${this.config.checkpointName}`);

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
    console.log(`[ComfyUI] Queued prompt: ${prompt_id}`);

    // Poll for completion
    const result = await this.waitForCompletion(prompt_id);
    console.log(`[ComfyUI] Result status: ${result.status}, url: ${result.data?.url || 'none'}`);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Image generation failed');
    }

    return result.data!;
  }

  async checkStatus(promptId: string): Promise<TaskResult<ImageOutput>> {
    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);

      if (!response.ok) {
        console.log(`[ComfyUI] History not ready for ${promptId}`);
        return { status: 'processing' };
      }

      const history = (await response.json()) as HistoryResponse;
      const promptHistory = history[promptId];

      if (!promptHistory) {
        console.log(`[ComfyUI] No history found for ${promptId}`);
        return { status: 'processing' };
      }

      console.log(`[ComfyUI] Status: ${promptHistory.status.status_str}, completed: ${promptHistory.status.completed}`);

      if (!promptHistory.status.completed) {
        return { status: 'processing' };
      }

      // Find the output image
      console.log(`[ComfyUI] Outputs:`, JSON.stringify(promptHistory.outputs, null, 2));
      for (const nodeOutput of Object.values(promptHistory.outputs)) {
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const image = nodeOutput.images[0];
          const imageUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${encodeURIComponent(image.type)}`;

          return {
            status: 'completed',
            data: {
              url: imageUrl,
              width: 1024, // Default, would need to be extracted from image
              height: 1024,
            },
          };
        }
      }

      return { status: 'failed', error: 'No output image found' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async waitForCompletion(
    promptId: string,
    maxWaitMs: number = 300000,
    pollIntervalMs: number = 2000
  ): Promise<TaskResult<ImageOutput>> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkStatus(promptId);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'failed', error: 'Timeout waiting for image generation' };
  }

  private buildTextToImageWorkflow(input: ImageInput): ComfyUIWorkflow {
    const width = input.width || 1024;
    const height = input.height || 1024;
    const seed = Math.floor(Math.random() * 1000000000);
    const { checkpointName, samplerName, scheduler, steps, cfg } = this.config;

    console.log(`[ComfyUI] Building workflow with checkpoint: ${checkpointName}`);

    // Basic SDXL workflow
    return {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: steps || 20,
          cfg: cfg || 7,
          sampler_name: samplerName || 'euler',
          scheduler: scheduler || 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: checkpointName,
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width,
          height,
          batch_size: 1,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.prompt,
          clip: ['4', 1],
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.negativePrompt || 'bad quality, blurry, distorted',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'ai_video_studio',
          images: ['8', 0],
        },
      },
    };
  }

  // Build workflow for image-to-image with reference
  buildImageToImageWorkflow(
    input: ImageInput,
    referenceImagePath: string
  ): ComfyUIWorkflow {
    const width = input.width || 1024;
    const height = input.height || 1024;
    const seed = Math.floor(Math.random() * 1000000000);
    const { checkpointName, samplerName, scheduler, steps, cfg } = this.config;

    return {
      '1': {
        class_type: 'LoadImage',
        inputs: {
          image: referenceImagePath,
        },
      },
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: steps || 20,
          cfg: cfg || 7,
          sampler_name: samplerName || 'euler',
          scheduler: scheduler || 'normal',
          denoise: 0.75,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['10', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: checkpointName,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.prompt,
          clip: ['4', 1],
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.negativePrompt || 'bad quality, blurry, distorted',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'ai_video_studio',
          images: ['8', 0],
        },
      },
      '10': {
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['11', 0],
          vae: ['4', 2],
        },
      },
      '11': {
        class_type: 'ImageScale',
        inputs: {
          upscale_method: 'lanczos',
          width,
          height,
          crop: 'center',
          image: ['1', 0],
        },
      },
    };
  }
}
