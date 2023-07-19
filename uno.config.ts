import { defineConfig, presetUno } from 'unocss';
import extractorSvelte from '@unocss/extractor-svelte';
import transformerDirectives from '@unocss/transformer-directives';

export default defineConfig({
	shortcuts: [
		// ...
	],
	theme: {
		colors: {
			// ...
		}
	},
	presets: [presetUno()],
	extractors: [extractorSvelte()],
	transformers: [transformerDirectives()]
});
