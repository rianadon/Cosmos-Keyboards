import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/kit/vite'
import { preprocessThrelte } from '@threlte/preprocess'
import seqPreprocessor from 'svelte-sequential-preprocessor'

const dev = process.argv.includes('dev')

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: seqPreprocessor([vitePreprocess(), preprocessThrelte()]),

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    paths: {
      base: dev ? '' : process.env.BASE_PATH,
    },
  },
}

export default config
