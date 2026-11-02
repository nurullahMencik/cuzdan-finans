import { defineConfig, devices } from '@playwright/test'

const PORT = 5303
const isCI = Boolean(process.env.CI)

/** End-to-end tests run against the production build served by `vite preview`. */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['screenshots/**'],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/cuzdan-finans/`,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview`,
    url: `http://localhost:${PORT}/cuzdan-finans/`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
})
