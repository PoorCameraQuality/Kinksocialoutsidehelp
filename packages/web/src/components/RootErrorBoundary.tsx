import { captureClientException } from '@/lib/error-tracking'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = {
  hasError: boolean
  message: string
}

/**
 * Surfaces render errors instead of a blank screen (common when a child throws during initial paint).
 */
export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack)
    captureClientException(error, { componentStack: info.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dc-surface-muted p-6 text-dc-text">
          <h1 className="text-xl font-semibold text-dc-text">Something went wrong</h1>
          <p className="mt-2 text-sm text-dc-text-muted">
            The app hit a runtime error. Check the browser console for details.
          </p>
          <pre className="mt-4 overflow-auto rounded-lg border border-dc-border bg-dc-elevated/95 p-4 text-xs text-amber-200">
            {this.state.message}
          </pre>
          <button
            type="button"
            className="mt-6 rounded-lg bg-dc-accent px-4 py-2 text-sm font-medium text-dc-text"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
