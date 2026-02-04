// Debug import order
console.log('=== DEBUG IMPORT ===')
console.log('1. Before any import - COMFYUI_CHECKPOINT:', process.env.COMFYUI_CHECKPOINT)

import { ComfyUIProvider } from '../src/lib/providers/image/comfyui'

console.log('2. After provider import - COMFYUI_CHECKPOINT:', process.env.COMFYUI_CHECKPOINT)

const directProvider = new ComfyUIProvider()
console.log('3. Direct provider config:', (directProvider as any).config)

import { generateQueue, startWorker } from '../src/lib/queue'

console.log('4. After queue import - COMFYUI_CHECKPOINT:', process.env.COMFYUI_CHECKPOINT)
console.log('5. Queue name:', (generateQueue as any).name)

// Now check what the worker uses
console.log('\n=== Testing startWorker ===')
startWorker(1)

// The worker creates its own provider instance - let's trace it
import * as workers from '../src/lib/queue/workers'

console.log('\nPress Ctrl+C to exit')
