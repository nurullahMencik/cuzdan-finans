import { defineConfig } from '@playwright/test'

/** Captures README screenshots from the production build: `npm run build && npm run screenshots`. */
export default defineConfig({
  testDir: './e2e/screenshots',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5303/cuzdan-finans/',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    // Native date inputs follow the browser UI language, not the page locale.
    // The full Chromium build (not the headless shell) ships the locale packs for that.
    channel: 'chromium',
    launchOptions: { args: ['--lang=tr-TR'], env: { ...process.env, LANG: 'tr_TR.UTF-8', LANGUAGE: 'tr' } },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5303/cuzdan-finans/',
    reuseExistingServer: !process.env.CI,
  },
})
