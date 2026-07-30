import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages serves this repo from `bbujnows.github.io/ghost-road/`, not from a domain
 * root — so every asset URL needs that prefix or the built page loads a white screen with
 * 404s in the console and no other clue what went wrong.
 *
 * It is set only for the production build. `npm run dev` keeps serving from `/`, because
 * a base path in dev would break the local server for no reason.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ghost-road/' : '/',
  plugins: [react()],
}))
