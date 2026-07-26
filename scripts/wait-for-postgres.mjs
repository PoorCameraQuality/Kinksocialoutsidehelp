/**
 * Wait until TCP accepts connections on the Postgres dev port (Docker mapping).
 * Prevents `drizzle-kit push` / seed from hanging silently while Postgres is still starting.
 */
import net from 'node:net'

const host = process.env.PGHOST ?? '127.0.0.1'
const port = parseInt(process.env.PGPORT ?? '6432', 10)
const maxAttempts = parseInt(process.env.DB_WAIT_ATTEMPTS ?? '45', 10)
const delayMs = parseInt(process.env.DB_WAIT_DELAY_MS ?? '2000', 10)
const socketTimeoutMs = 8000

function tryOnce() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    const t = setTimeout(() => {
      socket.destroy()
      reject(new Error('socket timeout'))
    }, socketTimeoutMs)
    socket.on('connect', () => {
      clearTimeout(t)
      socket.end()
      resolve(undefined)
    })
    socket.on('error', (err) => {
      clearTimeout(t)
      reject(err)
    })
  })
}

for (let i = 1; i <= maxAttempts; i++) {
  try {
    await tryOnce()
    console.log(`[wait-for-postgres] ${host}:${port} is reachable (attempt ${i}/${maxAttempts})`)
    process.exit(0)
  } catch {
    console.log(`[wait-for-postgres] attempt ${i}/${maxAttempts} — not ready, waiting ${delayMs}ms…`)
    await new Promise((r) => setTimeout(r, delayMs))
  }
}

console.error(
  `[wait-for-postgres] Gave up after ${maxAttempts} attempts. Is Docker running? Try: docker compose -f docker-compose.dev.yml up -d postgres`
)
process.exit(1)
