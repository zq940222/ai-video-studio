import { AIProvider, VideoInput, VideoOutput, TaskResult } from '../base';

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
        gifs?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
        videos?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

export class ComfyUIVideoProvider implements AIProvider<'video'> {
  name = 'ComfyUI-Wan2.1';
  type = 'video' as const;
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

  async generate(input: VideoInput): Promise<VideoOutput> {
    // Determine workflow type based on input
    const workflow = input.image
      ? this.buildImageToVideoWorkflow(input)
      : this.buildTextToVideoWorkflow(input);

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

    // Poll for completion (video generation takes longer)
    const result = await this.waitForCompletion(prompt_id);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Video generation failed');
    }

    return result.data!;
  }

  async checkStatus(promptId: string): Promise<TaskResult<VideoOutput>> {
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

      // Find the output video
      for (const nodeOutput of Object.values(promptHistory.outputs)) {
        const videos = nodeOutput.videos || nodeOutput.gifs;
        if (videos && videos.length > 0) {
          const video = videos[0];
          const videoUrl = `${this.baseUrl}/view?filename=${encodeURIComponent(video.filename)}&subfolder=${encodeURIComponent(video.subfolder)}&type=${encodeURIComponent(video.type)}`;

          return {
            status: 'completed',
            data: {
              url: videoUrl,
              duration: 5, // Default, Wan2.1 generates ~5s clips
              width: 1280,
              height: 720,
            },
          };
        }
      }

      return { status: 'failed', error: 'No output video found' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async waitForCompletion(
    promptId: string,
    maxWaitMs: number = 600000, // 10 minutes for video
    pollIntervalMs: number = 5000
  ): Promise<TaskResult<VideoOutput>> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.checkStatus(promptId);

      if (result.status === 'completed' || result.status === 'failed') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'failed', error: 'Timeout waiting for video generation' };
  }

  // Build workflow for image-to-video with Wan2.1
  private buildImageToVideoWorkflow(input: VideoInput): ComfyUIWorkflow {
    const { width, height } = this.getResolution(input.aspectRatio);
    const seed = Math.floor(Math.random() * 1000000000);

    return {
      // Load the source image
      '1': {
        class_type: 'LoadImage',
        inputs: {
          image: input.image!,
        },
      },
      // Resize image to target resolution
      '2': {
        class_type: 'ImageScale',
        inputs: {
          upscale_method: 'lanczos',
          width,
          height,
          crop: 'center',
          image: ['1', 0],
        },
      },
      // Load Wan2.1 model
      '3': {
        class_type: 'UNETLoader',
        inputs: {
          unet_name: 'wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors',
          weight_dtype: 'fp8_e4m3fn',
        },
      },
      // Load VAE
      '4': {
        class_type: 'VAELoader',
        inputs: {
          vae_name: 'wan_2.1_vae.safetensors',
        },
      },
      // Load CLIP
      '5': {
        class_type: 'CLIPLoader',
        inputs: {
          clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
          type: 'wan',
        },
      },
      // Encode prompt
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.prompt || 'smooth camera motion, cinematic quality',
          clip: ['5', 0],
        },
      },
      // Wan Image to Video
      '7': {
        class_type: 'WanImageToVideo',
        inputs: {
          width,
          height,
          length: 81, // ~5 seconds at 16fps
          batch_size: 1,
          image: ['2', 0],
        },
      },
      // KSampler for video generation
      '8': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: 30,
          cfg: 5,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['3', 0],
          positive: ['6', 0],
          negative: ['9', 0],
          latent_image: ['7', 0],
        },
      },
      // Negative prompt
      '9': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'blurry, distorted, low quality, static, no motion',
          clip: ['5', 0],
        },
      },
      // Decode video
      '10': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['8', 0],
          vae: ['4', 0],
        },
      },
      // Save video
      '11': {
        class_type: 'VHS_VideoCombine',
        inputs: {
          frame_rate: 16,
          loop_count: 0,
          filename_prefix: 'ai_video_studio',
          format: 'video/h264-mp4',
          save_output: true,
          images: ['10', 0],
        },
      },
    };
  }

  // Build workflow for text-to-video with Wan2.1
  private buildTextToVideoWorkflow(input: VideoInput): ComfyUIWorkflow {
    const { width, height } = this.getResolution(input.aspectRatio);
    const seed = Math.floor(Math.random() * 1000000000);

    return {
      // Load Wan2.1 T2V model
      '1': {
        class_type: 'UNETLoader',
        inputs: {
          unet_name: 'wan2.1_t2v_14B_fp8_e4m3fn.safetensors',
          weight_dtype: 'fp8_e4m3fn',
        },
      },
      // Load VAE
      '2': {
        class_type: 'VAELoader',
        inputs: {
          vae_name: 'wan_2.1_vae.safetensors',
        },
      },
      // Load CLIP
      '3': {
        class_type: 'CLIPLoader',
        inputs: {
          clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
          type: 'wan',
        },
      },
      // Encode prompt
      '4': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: input.prompt || 'cinematic video, high quality',
          clip: ['3', 0],
        },
      },
      // Empty latent for video
      '5': {
        class_type: 'EmptyWanLatentVideo',
        inputs: {
          width,
          height,
          length: 81,
          batch_size: 1,
        },
      },
      // KSampler
      '6': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: 30,
          cfg: 5,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['1', 0],
          positive: ['4', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      // Negative prompt
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'blurry, distorted, low quality, static',
          clip: ['3', 0],
        },
      },
      // Decode video
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['6', 0],
          vae: ['2', 0],
        },
      },
      // Save video
      '9': {
        class_type: 'VHS_VideoCombine',
        inputs: {
          frame_rate: 16,
          loop_count: 0,
          filename_prefix: 'ai_video_studio',
          format: 'video/h264-mp4',
          save_output: true,
          images: ['8', 0],
        },
      },
    };
  }

  private getResolution(aspectRatio?: '16:9' | '9:16' | '1:1'): {
    width: number;
    height: number;
  } {
    switch (aspectRatio) {
      case '9:16':
        return { width: 720, height: 1280 };
      case '1:1':
        return { width: 720, height: 720 };
      case '16:9':
      default:
        return { width: 1280, height: 720 };
    }
  }
}
