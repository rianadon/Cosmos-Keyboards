import extractorSvelte from '@unocss/extractor-svelte'
import transformerDirectives from '@unocss/transformer-directives'
import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  shortcuts: {
    's-help': 'align-[-18%] inline-block text-gray-600 dark:text-gray-100',
  },
  rules: [
    ['align-[-18%]', { 'vertical-align': '-18%' }],
  ],
  theme: {
    colors: {
      // ...
    },
    breakpoints: {
      xs: '520px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
    },
  },
  presets: [presetUno({
    dark: 'media',
  })],
  extractors: [extractorSvelte()],
  transformers: [transformerDirectives()],
})
