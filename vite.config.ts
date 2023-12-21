import { sveltekit } from '@sveltejs/kit/vite'
import { existsSync, readFileSync } from 'fs'
import { basename, resolve } from 'path'
import UnoCSS from 'unocss/vite'
import { defineConfig, type PluginOption } from 'vite'

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
    removeFS(),
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
    watch: {
      followSymlinks: false,
      ignored: ['.git', 'node_modules', 'venv'],
    },
    fs: { allow: ['.'] },
    proxy: {
      '/blog': 'http://localhost:8000/cosmos',
      '/docs': 'http://localhost:8000/cosmos',
      '/assets': 'http://localhost:8000/cosmos',
      '/stylesheets': 'http://localhost:8000/cosmos',
      '/livereload': 'http://localhost:8000',
      '/search': 'http://localhost:8000/cosmos',
    },
  },
})

/**
 * Add exports to mediapipe.
 * Simplified from the vite-plugin-mediapipe npm repo.
 */
function mediapipe(config: Record<string, string[]>): PluginOption {
  return {
    name: 'mediapipe',
    load(id: string) {
      const fileName = basename(id)
      if (!(fileName in config)) return null

      let code = readFileSync(id, 'utf-8')
      for (const name of config[fileName]) {
        code += `exports.${name} = ${name};`
      }
      return { code }
    },
  }
}

/* Remove any fs imports so vite doesn't try anything smart. */
function removeFS(): PluginOption {
  return {
    name: 'remove fs import',
    async transform(code, _id) {
      if (code.includes('process.env.FS')) {
        return code.replaceAll('import(process.env.FS!)', 'Promise.resolve(false)').replaceAll('!!import.meta.env', 'true')
      }
      return undefined
    },
    enforce: 'pre',
  }
}
