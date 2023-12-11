import { sveltekit } from '@sveltejs/kit/vite'
import { existsSync } from 'fs'
import { resolve } from 'path'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import { mediapipe } from 'vite-plugin-mediapipe'

const proDir = resolve(__dirname, './src/lib/worker/pro')
const proPatchDir = resolve(__dirname, './src/lib/worker/pro-patch')
const hasPro = existsSync(proDir)

export default defineConfig({
  resolve: {
    alias: {
      '$assets': resolve(__dirname, './src/assets'),
      '$target': resolve(__dirname, './target'),
      '@pro': hasPro ? proDir : proPatchDir,
    },
  },
  plugins: [
    UnoCSS(),
    sveltekit(),
    mediapipe({
      'hands.js': ['Hands', 'VERSION'],
    }),
  ],
  ssr: {
    noExternal: ['three', '@popperjs/core'],
  },
  server: {
    fs: { allow: ['.'] },
  },
})
