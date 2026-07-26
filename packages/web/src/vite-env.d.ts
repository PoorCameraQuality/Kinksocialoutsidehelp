/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_AUTH_ALLOW_FALLBACK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
