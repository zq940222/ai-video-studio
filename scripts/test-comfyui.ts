// Direct test of ComfyUI provider
import { ComfyUIProvider } from '../src/lib/providers/image/comfyui'

async function testComfyUI() {
  const provider = new ComfyUIProvider(process.env.COMFYUI_URL || 'http://localhost:8188')

  console.log('=== Testing ComfyUI Provider ===\n')
  console.log(`URL: ${process.env.COMFYUI_URL}`)
  console.log(`Checkpoint: ${process.env.COMFYUI_CHECKPOINT}\n`)

  // Check availability
  const available = await provider.isAvailable()
  console.log(`ComfyUI available: ${available}`)

  if (!available) {
    console.log('ComfyUI is not available. Make sure it is running.')
    process.exit(1)
  }

  // Generate image
  console.log('\nGenerating image...')
  const startTime = Date.now()

  try {
    const result = await provider.generate({
      prompt: '一个美丽的古代宫殿，阳光透过窗户照进来',
      negativePrompt: 'blurry, distorted, low quality',
      width: 512,
      height: 512,
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\nGeneration completed in ${elapsed}s`)
    console.log(`Result URL: ${result.url}`)
    console.log(`Dimensions: ${result.width}x${result.height}`)
  } catch (error) {
    console.error('Generation failed:', error)
    process.exit(1)
  }

  console.log('\nTest complete!')
  process.exit(0)
}

testComfyUI()
