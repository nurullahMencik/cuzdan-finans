import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

/**
 * GitHub Pages has no SPA rewrites. Serving a copy of index.html as 404.html
 * lets deep links such as /cuzdan-finans/transactions boot the app, after
 * which React Router resolves the path on the client.
 */
function githubPagesSpaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base: '/cuzdan-finans/',
  plugins: [react(), tailwindcss(), githubPagesSpaFallback()],
  server: { port: 5303, strictPort: true },
  preview: { port: 5303, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
