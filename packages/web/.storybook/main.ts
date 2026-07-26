import type { StorybookConfig } from '@storybook/react-vite'
import path from 'node:path'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.mdx', '../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    const workspaceRoot = path.resolve(__dirname, '../..')
    const sharedRoot = path.resolve(__dirname, '../../shared')
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
          '@c2k/shared': path.resolve(sharedRoot, 'src/index.ts'),
          'next/link': path.resolve(__dirname, '../src/shims/next-link.tsx'),
          'next/navigation': path.resolve(__dirname, '../src/shims/next-navigation.ts'),
        },
      },
      server: {
        fs: {
          allow: [workspaceRoot, sharedRoot, path.resolve(__dirname, '..')],
        },
      },
    })
  },
}

export default config
