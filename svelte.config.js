import { preprocessMeltUI, sequence } from '@melt-ui/pp'
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { preprocessor as documentPreprocessor } from '@sveltekit-addons/document'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
const dev = process.argv.includes('dev')
const proDir = fileURLToPath(new URL('./src/lib/worker/pro', import.meta.url))
const proPatchDir = fileURLToPath(new URL('./src/lib/worker/pro-patch', import.meta.url))
const hasPro = existsSync(proDir)
/** @type {import('@sveltejs/kit').Config}*/
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: sequence([vitePreprocess(), documentPreprocessor(), preprocessMeltUI()]),
  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      '$assets': 'src/assets',
      '$target': 'target',
      '@pro': hasPro ? proDir : proPatchDir,
    },
    paths: {
      base: dev ? '' : process.env.BASE_PATH,
    },
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Ignore links to docs and blogs
        // These are handled by mkdocs, and sveltekit does not know about them
        if (path.startsWith((process.env.BASE_PATH || '') + '/blog/')) return
        if (path.startsWith((process.env.BASE_PATH || '') + '/docs/')) return
        if (!hasPro) {
          if (path.startsWith((process.env.BASE_PATH || '') + '/plum-twist/')) return
          if (path.startsWith((process.env.BASE_PATH || '') + '/pumpkin/')) return
          if (path.startsWith((process.env.BASE_PATH || '') + '/lemon/')) return
        }
        // otherwise fail the build
        throw new Error(message)
      },
      handleMissingId: ({ path, id, message }) => {
        // Ignore missing ids on the generator page.
        if (path.startsWith((process.env.BASE_PATH || '') + '/beta')) return
        throw new Error(message)
      },
    },
  },
}
export default config
