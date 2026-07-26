import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { RouterProvider } from 'react-router-dom'
import RootErrorBoundary from '@/components/RootErrorBoundary'
import { initErrorTracking, captureClientException } from '@/lib/error-tracking'
import { clearStaleLocalServiceWorkers } from '@/dev-sw-cleanup'
import { disableBrowserScrollRestoration } from '@/lib/scroll-app-to-top'
import { applyBrowserDocumentClasses } from '@/lib/apply-browser-document-classes'
import { router } from './router'
import './app/globals.css'

async function bootstrap() {
  initErrorTracking()

  window.addEventListener('error', (event) => {
    captureClientException(event.error ?? new Error(event.message))
  })
  window.addEventListener('unhandledrejection', (event) => {
    captureClientException(event.reason)
  })

  disableBrowserScrollRestoration()
  applyBrowserDocumentClasses()
  await clearStaleLocalServiceWorkers()

  const rootEl = document.getElementById('root')
  if (!rootEl) {
    throw new Error('Missing #root element')
  }

  createRoot(rootEl).render(
    <RootErrorBoundary>
      <StrictMode>
        <HelmetProvider>
          <RouterProvider router={router} />
        </HelmetProvider>
      </StrictMode>
    </RootErrorBoundary>,
  )

  // Offline shell is production-only (localhost clears SW in dev-sw-cleanup before boot).
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw-offline.js').catch(() => {
        /* offline shell optional */
      })
    })
  }
}

void bootstrap()
