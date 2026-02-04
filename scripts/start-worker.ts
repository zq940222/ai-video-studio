// Worker startup script
// Run with: pnpm worker

import { startWorker, stopWorker, connection } from '../src/lib/queue'

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10)

console.log('Starting BullMQ worker...')
console.log(`Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`)
console.log(`Concurrency: ${CONCURRENCY}`)

// Start worker
startWorker(CONCURRENCY)

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`)

  await stopWorker()
  await connection.quit()

  console.log('Worker shutdown complete')
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Keep process alive
console.log('Worker is running. Press Ctrl+C to stop.')
