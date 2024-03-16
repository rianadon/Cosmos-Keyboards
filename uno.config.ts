import extractorSvelte from '@unocss/extractor-svelte'
import transformerDirectives from '@unocss/transformer-directives'
import { defineConfig, presetUno } from 'unocss'

export default defineConfig({
  shortcuts: {
    's-help': 'align-[-18%] inline-block text-gray-600 dark:text-gray-100',
    's-link': 'text-brand-lightpink hover:underline',
  },
  rules: [
    ['align-[-18%]', { 'vertical-align': '-18%' }],
    ['text-sm', { 'font-size': '0.9rem', 'line-height': '1.25rem' }],
  ],
  theme: {
    colors: {
      brand: {
        lightpink: '#ff9ef9',
        pink: '#f57aec',
        green: '#68e4a9',
        amber: '#e3c28c',
      },
    },
    breakpoints: {
      xs: '520px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1320px',
    },
    fontFamily: {
      system: '-apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto, arial, sans-serif',
      urbanist: 'Urbanist, sans-serif',
    },
  },
  presets: [presetUno({
    dark: 'media',
  })],
  extractors: [extractorSvelte()],
  transformers: [transformerDirectives()],
})
