import { sveltekit } from '@sveltejs/kit/vite'
import { readFileSync, writeFileSync } from 'fs'
import { basename, dirname } from 'path'
import UnoCSS from 'unocss/vite'
import { defineConfig, type PluginOption } from 'vite'

export default defineConfig({
  plugins: [
    removeFS(),
    artoolkit(),
    opencv(),
    UnoCSS(),
    sveltekit(),
    mediapipe({
      'hands.js': ['Hands', 'VERSION'],
    }),
  ],
  ssr: {
    noExternal: ['three', '@popperjs/core', '@ar-js-org/artoolkit5-js', '@hpmason/opencv-contrib-wasm'],
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
      '/javascripts': 'http://localhost:8000/cosmos',
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

// Remove unnecessary references to window in js ar toolkit
// And transform it to es6 exports
function artoolkit(): PluginOption {
  return {
    name: 'artoolkit',
    load(id: string) {
      const fileName = basename(id)
      if (fileName != 'ARToolkit.js') return null

      let code = readFileSync(id, 'utf-8')
      code = code.replace('window.FormData', '{}')
      code = 'const exports={};' + code + ';export default exports'
      return { code }
    },
  }
}

// Deal with that pesky wasm thing
function opencv(): PluginOption {
  return {
    name: 'opencv',
    load(id: string) {
      if (!id.includes('@hpmason/opencv-contrib-wasm')) return null
      const fileName = basename(id)

      let code = readFileSync(id, 'utf-8')
      if (fileName == 'index.js') {
        code = code.replace('module.exports = ', 'import cv from "./opencv.js"; const exp =')
        code = code.replace("require('./opencv.js')", 'cv')
        code += '; export { cv }; export const cvTranslateError = exp.cvTranslateError'
        return { code }
      } else if (fileName == 'opencv.js') {
        code = code.replace('__dirname', '""')
        code = code.replace(/require\(/g, 'console.error(')
        code = code.replace('ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER', 'false')
        code = code.replace('typeof window === "object"', 'true')
        // code = code.replace(/document.currentScript.src/g, 'wasmPath')
        code = code.replace(/document\.currentScript/g, 'false')
        const binary = readFileSync(dirname(id) + '/opencv.wasm', { encoding: 'base64' })

        // code = code.replace('Module = {}', `Module = { wasmBinary: "data:application/octet-stream;base64,${binary}" }`)
        code = code.replace('./opencv.wasm', 'data:application/octet-stream;base64,' + binary)
        code = code.replace('this', '{}')
        // code = code.replace('locateFile(wasmBinaryFile)', 'wasmPath')
        // code = "import wasmPath from './opencv.wasm?url';" + code
        // code = 'const exports = {};' + code + 'export const cv = exports.cv'
        writeFileSync('src/lib/opencv-contrib.js', code)
        return { code }
      }

      return null
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
