import { defineConfig, devices } from '@playwright/test'



/**

 * C2K E2E — route smokes, workflow contracts, mobile UX checks.

 * Run: npm run test:e2e:install && npm run test:e2e

 * Smoke only: npm run test:e2e:smoke

 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'



export default defineConfig({

  testDir: './e2e',

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? 'github' : 'list',

  use: {

    baseURL,

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: 'off',

  },

  projects: [

    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /\.mobile\.spec\.ts$/ },

    {

      name: 'chromium-mobile',

      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },

      testMatch: /route-smoke\.mobile|door\.spec|\.mobile\.spec/,

    },

  ],

  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER

    ? undefined

    : {

        command: 'npm run dev',

        cwd: '.',

        url: baseURL,

        reuseExistingServer: !process.env.CI,

        timeout: 180_000,

      },

})


