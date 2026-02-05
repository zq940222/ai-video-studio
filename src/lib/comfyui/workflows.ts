/**
 * ComfyUI Workflow Builders
 * Shared workflow templates for image generation
 */

// Model type: 'sd15' for SD 1.5, 'sdxl' for SDXL, 'flux' for FLUX, 'wan21' for Wan2.1
export type ModelType = 'sd15' | 'sdxl' | 'flux' | 'wan21';

export function getModelType(): ModelType {
  return (process.env.COMFYUI_MODEL_TYPE as ModelType) || 'sd15';
}

interface WorkflowOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  filenamePrefix?: string;
  // For img2img
  referenceImageUrl?: string;
  referenceImageName?: string;  // Filename in ComfyUI input folder
  denoise?: number;  // 0.0-1.0, lower = more like reference
}

/**
 * Upload image to ComfyUI input folder
 * Returns the filename to use in LoadImage node
 */
export async function uploadImageToComfyUI(
  comfyuiUrl: string,
  imageUrl: string
): Promise<string> {
  // Fetch image from URL (MinIO)
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const imageName = `ref_${Date.now()}.png`;

  // Create form data for ComfyUI upload
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), imageName);
  formData.append('overwrite', 'true');

  // Upload to ComfyUI
  const uploadResponse = await fetch(`${comfyuiUrl}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload to ComfyUI: ${error}`);
  }

  const result = await uploadResponse.json();
  console.log(`[ComfyUI] Uploaded reference image: ${result.name}`);

  return result.name;
}

// SD 1.5 workflow - optimized for realistic models (ChilloutMix, Realistic Vision)
function buildSD15Workflow(options: WorkflowOptions): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'low quality, bad anatomy, worst quality, blurry',
    width = 512,
    height = 768,  // 2:3 ratio for full body
    steps = 28,    // More steps for better quality
    cfg = 7.5,     // Slightly higher CFG for realistic models
    filenamePrefix = 'output',
  } = options;

  const checkpoint = process.env.COMFYUI_SD15_CHECKPOINT || 'v1-5-pruned-emaonly.safetensors';
  const seed = Math.floor(Math.random() * 1000000000);

  return {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "dpmpp_2m",      // Better for realistic images
        "scheduler": "karras",            // Karras scheduler for smoother results
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": checkpoint
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["4", 1]
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["4", 1]
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["8", 0]
      }
    }
  };
}

// SD 1.5 img2img workflow - uses reference image for better likeness
// referenceImageName should be the filename uploaded to ComfyUI's input folder
function buildSD15Img2ImgWorkflow(options: WorkflowOptions & { referenceImageName?: string }): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'low quality, bad anatomy, worst quality, blurry',
    steps = 28,
    cfg = 7.5,
    filenamePrefix = 'output',
    referenceImageName = '',  // Filename in ComfyUI input folder
    denoise = 0.65,  // 0.6-0.75 preserves likeness while allowing style changes
  } = options;

  const checkpoint = process.env.COMFYUI_SD15_CHECKPOINT || 'v1-5-pruned-emaonly.safetensors';
  const seed = Math.floor(Math.random() * 1000000000);

  return {
    // Load checkpoint
    "1": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": checkpoint
      }
    },
    // Load reference image from ComfyUI input folder
    "2": {
      "class_type": "LoadImage",
      "inputs": {
        "image": referenceImageName
      }
    },
    // Encode reference image to latent
    "3": {
      "class_type": "VAEEncode",
      "inputs": {
        "pixels": ["2", 0],
        "vae": ["1", 2]
      }
    },
    // Positive prompt
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["1", 1]
      }
    },
    // Negative prompt
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["1", 1]
      }
    },
    // KSampler with img2img (denoise < 1)
    "6": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "dpmpp_2m",
        "scheduler": "karras",
        "denoise": denoise,
        "model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["3", 0]  // Use encoded reference image
      }
    },
    // Decode latent to image
    "7": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["6", 0],
        "vae": ["1", 2]
      }
    },
    // Save image
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["7", 0]
      }
    }
  };
}

// SDXL/Anime workflow
function buildSDXLWorkflow(options: WorkflowOptions): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'low quality, bad anatomy, worst quality, blurry',
    width = 1024,
    height = 1024,
    steps = 20,
    cfg = 7,
    filenamePrefix = 'output',
  } = options;

  const checkpoint = process.env.COMFYUI_CHECKPOINT || 'AnythingXL_xl.safetensors';
  const seed = Math.floor(Math.random() * 1000000000);

  return {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": checkpoint
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["4", 1]
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["4", 1]
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["8", 0]
      }
    }
  };
}

// FLUX GGUF workflow - optimized for 8G VRAM using quantized model
function buildFluxWorkflow(options: WorkflowOptions): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'anime, cartoon, illustration, drawing, 3d, cgi, render, low quality, bad hands, deformed',
    width = 896,
    height = 1152,  // ~2:3 ratio for full body
    steps = 20,
    filenamePrefix = 'flux_output',
  } = options;

  // GGUF quantized model for 8G VRAM
  const unetName = process.env.COMFYUI_FLUX_UNET || 'flux1-dev-Q4_K_S.gguf';
  const clipT5 = process.env.COMFYUI_FLUX_CLIP_T5 || 't5xxl_fp8_e4m3fn.safetensors';
  const clipL = process.env.COMFYUI_FLUX_CLIP_L || 'clip_l.safetensors';
  const vaeName = process.env.COMFYUI_FLUX_VAE || 'ae.safetensors';
  const guidance = parseFloat(process.env.COMFYUI_FLUX_GUIDANCE || '3.5');
  const seed = Math.floor(Math.random() * 1000000000000);

  return {
    // Load GGUF quantized UNET
    "1": {
      "class_type": "UnetLoaderGGUF",
      "inputs": {
        "unet_name": unetName
      }
    },
    // Load dual CLIP (T5 + CLIP-L)
    "2": {
      "class_type": "DualCLIPLoader",
      "inputs": {
        "clip_name1": clipT5,
        "clip_name2": clipL,
        "type": "flux",
        "device": "default"
      }
    },
    // Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": vaeName
      }
    },
    // Positive prompt encoding
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    // Negative prompt encoding
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["2", 0]
      }
    },
    // FLUX Guidance (replaces CFG for FLUX)
    "7": {
      "class_type": "FluxGuidance",
      "inputs": {
        "guidance": guidance,
        "conditioning": ["4", 0]
      }
    },
    // Empty latent image
    "8": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    // KSampler (cfg=1 for FLUX, guidance is handled by FluxGuidance)
    "6": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": 1,  // FLUX uses cfg=1, guidance is separate
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["7", 0],  // Use FluxGuidance output
        "negative": ["5", 0],
        "latent_image": ["8", 0]
      }
    },
    // VAE Decode
    "9": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["6", 0],
        "vae": ["3", 0]
      }
    },
    // Save image (node 10 for consistency with user's workflow)
    "10": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["9", 0]
      }
    }
  };
}

// FLUX GGUF img2img workflow - uses reference image for better likeness
function buildFluxImg2ImgWorkflow(options: WorkflowOptions & { referenceImageName?: string }): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'anime, cartoon, illustration, drawing, 3d, cgi, render, low quality, bad hands, deformed',
    steps = 20,
    filenamePrefix = 'flux_img2img',
    referenceImageName = '',
    denoise = 0.6,  // 0.5-0.7 preserves likeness while allowing style changes
  } = options;

  // GGUF quantized model for 8G VRAM
  const unetName = process.env.COMFYUI_FLUX_UNET || 'flux1-dev-Q4_K_S.gguf';
  const clipT5 = process.env.COMFYUI_FLUX_CLIP_T5 || 't5xxl_fp8_e4m3fn.safetensors';
  const clipL = process.env.COMFYUI_FLUX_CLIP_L || 'clip_l.safetensors';
  const vaeName = process.env.COMFYUI_FLUX_VAE || 'ae.safetensors';
  const guidance = parseFloat(process.env.COMFYUI_FLUX_GUIDANCE || '3.5');
  const seed = Math.floor(Math.random() * 1000000000000);

  return {
    // Load GGUF quantized UNET
    "1": {
      "class_type": "UnetLoaderGGUF",
      "inputs": {
        "unet_name": unetName
      }
    },
    // Load dual CLIP (T5 + CLIP-L)
    "2": {
      "class_type": "DualCLIPLoader",
      "inputs": {
        "clip_name1": clipT5,
        "clip_name2": clipL,
        "type": "flux",
        "device": "default"
      }
    },
    // Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": vaeName
      }
    },
    // Load reference image
    "11": {
      "class_type": "LoadImage",
      "inputs": {
        "image": referenceImageName
      }
    },
    // Encode reference image to latent
    "12": {
      "class_type": "VAEEncode",
      "inputs": {
        "pixels": ["11", 0],
        "vae": ["3", 0]
      }
    },
    // Positive prompt encoding
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    // Negative prompt encoding
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["2", 0]
      }
    },
    // FLUX Guidance
    "7": {
      "class_type": "FluxGuidance",
      "inputs": {
        "guidance": guidance,
        "conditioning": ["4", 0]
      }
    },
    // KSampler with img2img (denoise < 1)
    "6": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": denoise,
        "model": ["1", 0],
        "positive": ["7", 0],
        "negative": ["5", 0],
        "latent_image": ["12", 0]  // Use encoded reference image
      }
    },
    // VAE Decode
    "9": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["6", 0],
        "vae": ["3", 0]
      }
    },
    // Save image
    "10": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["9", 0]
      }
    }
  };
}

// Wan2.1 workflow for realistic image/video generation (8G VRAM compatible with 1.3B model)
// Generates single frame as image
function buildWan21Workflow(options: WorkflowOptions): Record<string, unknown> {
  const {
    prompt,
    negativePrompt = 'blurry, low quality, distorted, deformed, ugly, watermark, text',
    width = 640,
    height = 640,
    steps = 25,
    cfg = 5,
    filenamePrefix = 'wan21_output',
  } = options;

  const modelName = process.env.COMFYUI_WAN21_MODEL || 'wan2.1_t2v_1.3B_fp16.safetensors';
  const textEncoderName = process.env.COMFYUI_WAN21_TEXT_ENCODER || 'umt5_xxl_fp8_e4m3fn_scaled.safetensors';
  const vaeName = process.env.COMFYUI_WAN21_VAE || 'wan_2.1_vae.safetensors';
  const seed = Math.floor(Math.random() * 1000000000);

  // Wan2.1 workflow based on user's tested workflow
  return {
    // Load Wan2.1 diffusion model
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": modelName,
        "weight_dtype": "default"
      }
    },
    // Load text encoder (UMT5) - requires 3 params: clip_name, type, device
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": textEncoderName,
        "type": "wan",
        "device": "default"
      }
    },
    // Load VAE
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": vaeName
      }
    },
    // Text encode positive
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    // Text encode negative
    "5": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": negativePrompt,
        "clip": ["2", 0]
      }
    },
    // Empty Latent - use standard EmptyLatentImage for maximum compatibility
    // Note: For video generation, use EmptyWanLatentVideo with length > 1
    "6": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    // Sampler
    "7": {
      "class_type": "KSampler",
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "normal",
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
    // Save Image (for single frame) - node 9 is used for image output detection
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": filenamePrefix,
        "images": ["8", 0]
      }
    }
  };
}

/**
 * Build image generation workflow based on current model type
 * Uses img2img when referenceImageUrl is provided
 */
export function buildImageWorkflow(options: WorkflowOptions): Record<string, unknown> {
  const modelType = getModelType();
  const hasReference = !!options.referenceImageUrl;
  console.log(`[ComfyUI] Building workflow - model: ${modelType}, img2img: ${hasReference}`);

  switch (modelType) {
    case 'flux':
      // Use img2img if reference image name is provided
      if (options.referenceImageName) {
        console.log(`[ComfyUI] Using FLUX img2img with reference: ${options.referenceImageName}`);
        return buildFluxImg2ImgWorkflow({
          ...options,
          referenceImageName: options.referenceImageName,
          denoise: options.denoise || 0.55,
        });
      }
      return buildFluxWorkflow(options);
    case 'sdxl':
      return buildSDXLWorkflow(options);
    case 'wan21':
      // Wan2.1 for 8G VRAM - limit total pixels to ~350k (equiv to 640x550)
      // Allow wider aspect ratios for character sheets
      const maxPixels = 350000;
      const w21 = options.width || 640;
      const h21 = options.height || 640;
      const pixels = w21 * h21;
      const scale = pixels > maxPixels ? Math.sqrt(maxPixels / pixels) : 1;
      return buildWan21Workflow({
        ...options,
        width: Math.round((w21 * scale) / 8) * 8,  // Round to multiple of 8
        height: Math.round((h21 * scale) / 8) * 8,
      });
    case 'sd15':
    default:
      // Use img2img if reference image name is provided (already uploaded to ComfyUI)
      if (options.referenceImageName) {
        console.log(`[ComfyUI] Using img2img with reference: ${options.referenceImageName}`);
        return buildSD15Img2ImgWorkflow({
          ...options,
          referenceImageName: options.referenceImageName,
          denoise: options.denoise || 0.6,  // Default denoise for character likeness
        });
      }
      // SD 1.5 txt2img uses smaller resolution
      return buildSD15Workflow({
        ...options,
        width: Math.min(options.width || 512, 768),
        height: Math.min(options.height || 512, 768),
      });
  }
}

/**
 * Execute workflow and wait for result
 */
export async function executeWorkflow(
  comfyuiUrl: string,
  workflow: Record<string, unknown>,
  timeoutMs: number = 120000
): Promise<{ success: true; imageUrl: string; promptId: string } | { success: false; error: string }> {
  try {
    // Queue the workflow
    const queueResponse = await fetch(`${comfyuiUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResponse.ok) {
      const error = await queueResponse.text();
      console.error('ComfyUI queue error:', error);
      return { success: false, error: `ComfyUI 请求失败: ${error}` };
    }

    const queueData = await queueResponse.json();
    const promptId = queueData.prompt_id;
    console.log(`[ComfyUI] Queued prompt: ${promptId}`);

    // Poll for completion
    const maxAttempts = Math.floor(timeoutMs / 1000);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const historyResponse = await fetch(`${comfyuiUrl}/history/${promptId}`);
      if (!historyResponse.ok) continue;

      const history = await historyResponse.json();
      const result = history[promptId];

      // Check for output in node 9 or 10 (FLUX uses node 10)
      const outputNode = result?.outputs?.["9"]?.images?.[0]
        ? result.outputs["9"]
        : result?.outputs?.["10"]?.images?.[0]
          ? result.outputs["10"]
          : null;

      if (outputNode?.images?.[0]) {
        const image = outputNode.images[0];
        const imageUrl = `${comfyuiUrl}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`;
        console.log(`[ComfyUI] Generated image: ${imageUrl}`);
        return { success: true, imageUrl, promptId };
      }

      // Check for execution errors
      if (result?.status?.status_str === 'error') {
        const errorInfo = result.status.messages?.find((m: unknown[]) => m[0] === 'execution_error');
        const errorMsg = (errorInfo?.[1] as { exception_message?: string })?.exception_message || '执行失败';
        return { success: false, error: `生成失败: ${errorMsg}` };
      }
    }

    return { success: false, error: '生成超时，请重试' };
  } catch (error) {
    console.error('ComfyUI execution error:', error);
    return { success: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}
