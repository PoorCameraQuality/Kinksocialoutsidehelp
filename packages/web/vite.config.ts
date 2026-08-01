import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  buildKinkSocialCsafProviderMetadata,
  buildKinkSocialRobotsTxt,
  buildKinkSocialSecurityTxt,
  buildKinkSocialSitemapXml,
  isKinkSocialPublicIndexPath,
  isKinkSocialPublicLaunchEnabled,
  KINK_SOCIAL_X_ROBOTS_TAG,
} from '../shared/src/seo-policy.ts'

const workspaceRoot = path.resolve(__dirname, '../..')
const sharedRoot = path.resolve(__dirname, '../shared')

function resolveSiteUrl(env: Record<string, string>): string {
  return env.VITE_SITE_URL?.trim() || 'https://kink.social'
}

/** Dev parity with prod crawl policy; sitemap only when VITE_PUBLIC_LAUNCH=true. */
function kinkSocialCrawlPolicy(mode: string) {
  const env = loadEnv(mode, workspaceRoot, '')
  const publicLaunch = isKinkSocialPublicLaunchEnabled(env.VITE_PUBLIC_LAUNCH)
  const siteUrl = resolveSiteUrl(env)
  const robotsTxt = buildKinkSocialRobotsTxt(publicLaunch, siteUrl)
  const securityTxt = buildKinkSocialSecurityTxt(siteUrl)
  const csafProviderMetadata = JSON.stringify(buildKinkSocialCsafProviderMetadata(siteUrl), null, 2)
  const sitemapXml = buildKinkSocialSitemapXml(siteUrl)

  return {
    name: 'c2k-kink-social-crawl-policy',
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string; method?: string; headers?: { accept?: string } },
            res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body?: string) => void },
            next: () => void,
          ) => void,
        ) => void
      }
    }) {
      server.middlewares.use((req, res, next) => {
        const urlPath = req.url?.split('?')[0] ?? ''

        if (/^\/sw-[^/]+\.js$/.test(urlPath)) {
          res.statusCode = 404
          res.end()
          return
        }

        if (urlPath === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(robotsTxt)
          return
        }

        if (urlPath === '/sitemap.xml') {
          if (!publicLaunch) {
            res.statusCode = 404
            res.end()
            return
          }
          res.setHeader('Content-Type', 'application/xml; charset=utf-8')
          res.end(sitemapXml)
          return
        }

        if (urlPath === '/security.txt') {
          res.statusCode = 301
          res.setHeader('Location', '/.well-known/security.txt')
          res.end()
          return
        }

        if (urlPath === '/.well-known/security.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(securityTxt)
          return
        }

        if (urlPath === '/.well-known/csaf/provider-metadata.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(csafProviderMetadata)
          return
        }

        const acceptsHtml = req.headers?.accept?.includes('text/html')
        if (req.method === 'GET' && acceptsHtml && !urlPath.startsWith('/api')) {
          const indexable = publicLaunch && isKinkSocialPublicIndexPath(urlPath || '/')
          res.setHeader('X-Robots-Tag', indexable ? 'index, follow' : KINK_SOCIAL_X_ROBOTS_TAG)
        }

        next()
      })
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(path.join(outDir, 'robots.txt'), robotsTxt, 'utf8')
      const wellKnownDir = path.join(outDir, '.well-known')
      mkdirSync(wellKnownDir, { recursive: true })
      writeFileSync(path.join(wellKnownDir, 'security.txt'), securityTxt, 'utf8')
      const csafDir = path.join(wellKnownDir, 'csaf')
      mkdirSync(csafDir, { recursive: true })
      writeFileSync(path.join(csafDir, 'provider-metadata.json'), csafProviderMetadata, 'utf8')
      if (publicLaunch) {
        writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml, 'utf8')
      }
    },
  }
}

/** In dev, block SW scripts so a stale worker cannot serve HTML for Vite modules. */
function disableServiceWorkersInDev(mode: string) {
  return kinkSocialCrawlPolicy(mode)
}

export default defineConfig(({ mode }) => ({
  envDir: workspaceRoot,
  plugins: [react(), disableServiceWorkersInDev(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/link': path.resolve(__dirname, './src/shims/next-link.tsx'),
      'next/navigation': path.resolve(__dirname, './src/shims/next-navigation.ts'),
      // Same as packages/web/tsconfig.json — explicit so dev + build agree; sources live outside packages/web.
      '@c2k/shared': path.resolve(sharedRoot, 'src/index.ts'),
    },
  },
  server: {
    // Allow monorepo packages outside packages/web (otherwise Vite returns 403 Restricted for @c2k/shared).
    fs: {
      allow: [workspaceRoot, sharedRoot, path.resolve(__dirname)],
    },
    // Bind IPv4 + IPv6 so http://127.0.0.1:5173 works (default localhost-only can be [::1] only on Windows).
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/share': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
}))
