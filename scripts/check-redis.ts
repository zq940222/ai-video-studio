import IORedis from 'ioredis'

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379')

async function check() {
  console.log('=== Redis Queue Check ===\n')

  const keys = await redis.keys('bull:generate:*')
  console.log('Generate queue keys:', keys)

  for (const key of keys) {
    const type = await redis.type(key)
    console.log(`\n${key} (${type}):`)

    if (type === 'string') {
      const val = await redis.get(key)
      console.log(`  ${val}`)
    } else if (type === 'hash') {
      const hash = await redis.hgetall(key)
      console.log(`  ${JSON.stringify(hash, null, 2)}`)
    } else if (type === 'zset') {
      const members = await redis.zrange(key, 0, -1)
      console.log(`  Members: ${members.join(', ')}`)
    } else if (type === 'list') {
      const items = await redis.lrange(key, 0, -1)
      console.log(`  Items: ${items.join(', ')}`)
    } else if (type === 'set') {
      const members = await redis.smembers(key)
      console.log(`  Members: ${members.join(', ')}`)
    }
  }

  await redis.quit()
}

check().catch(console.error)
