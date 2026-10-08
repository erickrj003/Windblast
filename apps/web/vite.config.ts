import process from 'node:process';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isRootRelative = (value: string): value is `/${string}` => value.startsWith('/');

/** GitHub Pages serves the site under /<repo>; the deploy workflow sets BASE_PATH. */
function basePath(): '' | `/${string}` {
	if (process.argv.includes('dev')) return '';
	const value = process.env['BASE_PATH'] ?? '';
	if (value === '') return '';
	if (isRootRelative(value)) return value;
	throw new Error(`BASE_PATH must be empty or start with "/", got "${value}"`);
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: '404.html',
				strict: true
			}),
			paths: {
				base: basePath()
			}
		})
	]
});
