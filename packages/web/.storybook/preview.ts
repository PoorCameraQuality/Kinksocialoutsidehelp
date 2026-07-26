import type { Preview } from '@storybook/react'
import '../src/app/globals.css'
import { withAppProvidersDecorator } from '../src/stories/decorators'

const preview: Preview = {
  decorators: [withAppProvidersDecorator],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'app-shell',
      values: [
        {
          name: 'app-shell',
          value: 'var(--dc-surface, #0c0a0b)',
        },
        {
          name: 'elevated',
          value: 'var(--dc-elevated-solid, #161214)',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile390: {
          name: 'Mobile 390',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        desktop1440: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    a11y: {
      // Advisory in Storybook — Pass 4 Playwright axe remains the CI gate.
      test: 'todo',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  initialGlobals: {
    viewport: { value: 'desktop1440', isRotated: false },
  },
}

export default preview
