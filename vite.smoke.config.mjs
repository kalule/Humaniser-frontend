// Local smoke server only: its own dep cache, so it never disturbs a dev server sharing node_modules.
import { mergeConfig } from 'vite'
import base from './vite.config.ts'
export default mergeConfig(base, { cacheDir: process.env.SMOKE_CACHE_DIR, server: { port: 5192, strictPort: true } })
