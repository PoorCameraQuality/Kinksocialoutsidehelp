import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

const defaultUrl = 'postgresql://c2k:c2k_dev@127.0.0.1:6432/c2k_dev?sslmode=disable'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? defaultUrl,
  /** Local Docker Postgres has no TLS; without this some Windows clients hang on SSL negotiation. */
  ssl: process.env.DATABASE_SSL === 'true' ? undefined : false,
  connectionTimeoutMillis: 15_000,
})

export const db = drizzle(pool, { schema })
export { schema }
export type Db = typeof db
