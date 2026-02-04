/**
 * FLUX Text-to-Image Workflow for ComfyUI
 * Generates realistic images using FLUX model
 */

export interface FluxWorkflowConfig {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  // Model paths
  unetName?: string;
  clipL?: string;
  clipT5?: string;
  vaeName?: string;
}

export function buildFluxTextToImageWorkflow(config: FluxWorkflowConfig): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = '',
    width = 1024,
    height = 1024,
    steps = 20,
    cfg = 3.5,
    seed = Math.floor(Math.random() * 1000000000),
    unetName = 'flux1-dev.safetensors',
    clipL = 'clip_l_bf16.safetensors',
    clipT5 = 't5xxl_fp16.safetensors',
    vaeName = 'flux-ae.safetensors',
  } = config;

  return {
    // Load FLUX UNet
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": unetName,
        "weight_dtype": "default"
      }
    },
    // Load CLIP models
    "2": {
      "class_type": "DualCLIPLoader",
      "inputs": {
        "clip_name1": clipL,
        "clip_name2": clipT5,
        "type": "flux"
      }
    },
    // Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": vaeName
      }
    },
    // CLIP Text Encode (positive)
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    // CLIP Text Encode (negative) - FLUX doesn't really use negative, but include for compatibility
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["2", 0]
      }
    },
    // Empty Latent Image
    "6": {
      "class_type": "EmptySD3LatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    // KSampler
    "7": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["6", 0]
      }
    },
    // VAE Decode
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["7", 0],
        "vae": ["3", 0]
      }
    },
    // Save Image
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": "flux_output",
        "images": ["8", 0]
      }
    }
  };
}
