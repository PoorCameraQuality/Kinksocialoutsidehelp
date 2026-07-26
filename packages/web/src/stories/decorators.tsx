import type { Decorator } from '@storybook/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { FixedAuthProvider, defaultStoryAuthValue } from '@/contexts/AuthContext'

type ProviderOptions = {
  authenticated?: boolean
  username?: string
  padded?: boolean
  maxWidth?: string
}

/** Dark app-shell wrapper matching kink.social member UI. */
export function StoryCanvas({
  children,
  padded = true,
  maxWidth = '720px',
}: {
  children: ReactNode
  padded?: boolean
  maxWidth?: string
}) {
  return (
    <div className="min-h-screen bg-dc-surface text-dc-text">
      <div
        className={padded ? 'mx-auto w-full px-4 py-8 sm:px-6' : 'w-full'}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  )
}

export function withAppProviders(options: ProviderOptions = {}): Decorator {
  const { authenticated = true, username = 'RopeDreamer', padded = true, maxWidth = '720px' } = options

  const DecoratorFn: Decorator = (Story, context) => {
    const params = (context.parameters.providers ?? {}) as ProviderOptions
    const authUser = params.username ?? username
    const authOn = params.authenticated ?? authenticated
    const pad = params.padded ?? padded
    const width = params.maxWidth ?? maxWidth

    return (
      <MemoryRouter initialEntries={['/home']}>
        <FixedAuthProvider
          value={defaultStoryAuthValue({
            viewerUsername: authUser,
            isAuthenticated: authOn,
            isFallback: !authOn,
          })}
        >
          <StoryCanvas padded={pad} maxWidth={width}>
            <Story />
          </StoryCanvas>
        </FixedAuthProvider>
      </MemoryRouter>
    )
  }

  return DecoratorFn
}

/** Default export used in preview.ts */
export const withAppProvidersDecorator: Decorator = withAppProviders()
