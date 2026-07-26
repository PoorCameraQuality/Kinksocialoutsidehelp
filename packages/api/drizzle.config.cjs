/* eslint-disable @typescript-eslint/no-require-imports */
const { config: loadEnv } = require('dotenv')
const { existsSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const { defineConfig } = require('drizzle-kit')

const rootEnv = resolve(__dirname, '../../.env.development')
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv })
}

const defaultUrl = 'postgresql://c2k:c2k_dev@127.0.0.1:6432/c2k_dev?sslmode=disable'

/** PostGIS installs catalog tables in `public` (e.g. `spatial_ref_sys`). Without this, `drizzle-kit push` can try to rename/drop them vs app tables and appear to hang on bogus prompts. */
const postgisCatalogExcludes = [
  '!spatial_ref_sys',
  '!geometry_columns',
  '!geography_columns',
  '!raster_columns',
  '!raster_overviews',
]

module.exports = defineConfig({
  // Compiled output: src/schema.ts re-exports organizer tables with `.js` suffix (Node ESM).
  schema: './dist/db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  extensionsFilters: ['postgis'],
  tablesFilter: postgisCatalogExcludes,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? defaultUrl,
  },
})
