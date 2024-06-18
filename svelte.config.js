import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { preprocessor as documentPreprocessor } from '@sveltekit-addons/document'
import seqPreprocessor from 'svelte-sequential-preprocessor'

const dev = process.argv.includes('dev')

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: seqPreprocessor([vitePreprocess(), documentPreprocessor()]),

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    paths: {
      base: dev ? '' : process.env.BASE_PATH,
    },
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Ignore links to docs and blogs
        // These are handled by mkdocs, and sveltekit does not know about them
        if (path.startsWith((process.env.BASE_PATH || '') + '/blog/')) return
        if (path.startsWith((process.env.BASE_PATH || '') + '/docs/')) return

        // otherwise fail the build
        throw new Error(message)
      },
    },
  },
}

export default config
