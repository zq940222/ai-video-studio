// Redis connection configuration for BullMQ
import IORedis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Shared connection for queues
export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
})

// Connection options for workers (create new connection per worker)
export const getWorkerConnection = () => {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

// Graceful shutdown
export const closeConnection = async () => {
  await connection.quit()
}
