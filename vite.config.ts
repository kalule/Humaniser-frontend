import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Node by default; a component test that needs a DOM opts in with `// @vitest-environment jsdom`.
    // .service-logs holds the Python runners' virtualenvs (they ship their own JS tests); landing/ is a separate app.
    exclude: [...configDefaults.exclude, '.service-logs/**', 'landing/**'],
    setupFiles: ['src/test/setupStorage.ts'],
  },
  server: {
    port: 4000,
    proxy: {
      '/api': {
        target: process.env.HUMANISE_API_PROXY ?? 'http://127.0.0.1:5062',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
