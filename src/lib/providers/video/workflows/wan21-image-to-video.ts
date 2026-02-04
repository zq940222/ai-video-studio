/**
 * Wan2.1 Image-to-Video Workflow for ComfyUI
 * Generates video from image using Wan2.1 model
 */

export interface Wan21WorkflowConfig {
  prompt: string;
  negativePrompt?: string;
  imageInputNode?: string; // Node ID that provides the input image
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  // Model paths
  modelName?: string;
  textEncoderName?: string;
  vaeName?: string;
}

export function buildWan21ImageToVideoWorkflow(config: Wan21WorkflowConfig): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'low quality, blurry, distorted',
    width = 832,
    height = 480,
    frames = 81,  // ~3 seconds at 24fps
    fps = 24,
    steps = 30,
    cfg = 5,
    seed = Math.floor(Math.random() * 1000000000),
    modelName = 'wan2.1_t2v_1.3B_fp16.safetensors',
    textEncoderName = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
    vaeName = 'wan_2.1_vae.safetensors',
  } = config;

  return {
    // Load Wan2.1 model
    "1": {
      "class_type": "DownloadAndLoadWan21Model",
      "inputs": {
        "model": modelName,
        "base_precision": "fp16",
        "quantization": "disabled"
      }
    },
    // Load Text Encoder
    "2": {
      "class_type": "DownloadAndLoadWan21TextEncoder",
      "inputs": {
        "model": textEncoderName,
        "precision": "fp8_e4m3fn"
      }
    },
    // Load VAE
    "3": {
      "class_type": "DownloadAndLoadWan21VAE",
      "inputs": {
        "model": vaeName,
        "precision": "fp16"
      }
    },
    // Text Encode (positive)
    "4": {
      "class_type": "Wan21TextEncode",
      "inputs": {
        "prompt": prompt,
        "wan21_text_encoder": ["2", 0]
      }
    },
    // Text Encode (negative)
    "5": {
      "class_type": "Wan21TextEncode",
      "inputs": {
        "prompt": negativePrompt,
        "wan21_text_encoder": ["2", 0]
      }
    },
    // Empty Latent Video
    "6": {
      "class_type": "Wan21EmptyLatentVideo",
      "inputs": {
        "width": width,
        "height": height,
        "length": frames,
        "batch_size": 1
      }
    },
    // Sampler
    "7": {
      "class_type": "Wan21Sampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "shift": 8,
        "denoise": 1,
        "wan21_model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "samples": ["6", 0]
      }
    },
    // VAE Decode
    "8": {
      "class_type": "Wan21VAEDecode",
      "inputs": {
        "samples": ["7", 0],
        "wan21_vae": ["3", 0]
      }
    },
    // Save Video
    "9": {
      "class_type": "VHS_VideoCombine",
      "inputs": {
        "frame_rate": fps,
        "loop_count": 0,
        "filename_prefix": "wan21_video",
        "format": "video/h264-mp4",
        "pingpong": false,
        "save_output": true,
        "images": ["8", 0]
      }
    }
  };
}

/**
 * Wan2.1 Text-to-Video Workflow
 * Generates video directly from text prompt
 */
export function buildWan21TextToVideoWorkflow(config: Wan21WorkflowConfig): Record<string, unknown> {
  // T2V uses the same workflow structure as I2V but without image input
  return buildWan21ImageToVideoWorkflow(config);
}
