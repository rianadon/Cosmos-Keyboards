import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import UnoCSS from 'unocss/vite';
import { mediapipe } from 'vite-plugin-mediapipe';

export default defineConfig({
	plugins: [
		UnoCSS(),
		sveltekit(),
		mediapipe({
			'hands.js': ['Hands', 'VERSION']
		})
	],
	ssr: {
		noExternal: ['three']
	}
});
