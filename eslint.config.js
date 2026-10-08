import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import ts from 'typescript-eslint';

/** Syntax banned in every TypeScript and Svelte file. */
const bannedSyntax = [
	{
		selector: 'TSEnumDeclaration',
		message: 'Use an `as const` object and a union type instead of `enum`.'
	},
	{
		selector: 'ExportDefaultDeclaration',
		message: 'Use named exports. Default exports are only for framework config files.'
	}
];

/** Clocks and ambient randomness: the engine and data must be deterministic. */
const nonDeterministicSyntax = [
	{
		selector: "NewExpression[callee.name='Date']",
		message: 'The engine has no clock. Pass time in as data if a rule ever needs it.'
	}
];

const nonDeterministicProperties = [
	{ object: 'Math', property: 'random', message: "Use the trial's seeded PRNG." },
	{ object: 'Date', property: 'now', message: 'The engine has no clock.' },
	{ object: 'performance', property: 'now', message: 'The engine has no clock.' }
];

const browserAndHostGlobals = [
	'window',
	'document',
	'navigator',
	'self',
	'globalThis',
	'crypto',
	'performance',
	'localStorage',
	'sessionStorage',
	'indexedDB',
	'fetch',
	'setTimeout',
	'setInterval',
	'requestAnimationFrame'
].map((name) => ({ name, message: `\`${name}\` is not allowed in pure packages.` }));

/**
 * Builds a `no-restricted-imports` rule that bans the given packages (and their subpaths).
 * @param {string[]} names
 * @param {string} message
 * @returns {import('eslint').Linter.RuleEntry}
 */
function banImports(names, message) {
	return [
		'error',
		{ patterns: [{ group: names.flatMap((name) => [name, `${name}/*`]), message }] }
	];
}

const uiAndHostPackages = ['svelte', 'pixi.js', 'dexie', 'comlink', 'node:*'];

export default defineConfig(
	globalIgnores([
		'**/node_modules/',
		'**/build/',
		'**/dist/',
		'**/.svelte-kit/',
		'**/coverage/',
		'**/playwright-report/',
		'**/test-results/',
		'packages/data/vendor/'
	]),
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	ts.configs.stylisticTypeChecked,
	svelte.configs.recommended,
	svelte.configs.prettier,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['*.js', 'scripts/*.ts', 'apps/web/vite.config.ts'],
					defaultProject: 'tsconfig.tooling.json'
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			// TypeScript reports undefined names itself; typescript-eslint recommends turning this off.
			'no-undef': 'off',
			'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
			'no-restricted-syntax': ['error', ...bannedSyntax],
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			// The project convention (typescript.md, PLAN.md API) is `ReadonlyArray<T>` for readonly data.
			'@typescript-eslint/array-type': ['error', { default: 'array-simple', readonly: 'generic' }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['*.config.js', '*.config.ts', '**/*.config.js', '**/*.config.ts'],
		rules: { 'no-restricted-syntax': 'off' }
	},
	{
		files: ['scripts/**'],
		rules: { 'no-console': 'off' }
	},
	{
		files: ['packages/data/**', 'packages/engine/**'],
		rules: {
			'no-restricted-syntax': ['error', ...bannedSyntax, ...nonDeterministicSyntax],
			'no-restricted-properties': ['error', ...nonDeterministicProperties],
			'no-restricted-globals': ['error', ...browserAndHostGlobals]
		}
	},
	{
		files: ['packages/data/**'],
		rules: {
			'no-restricted-imports': banImports(
				[...uiAndHostPackages, '@inazria/engine', '@inazria/sim', '@inazria/render'],
				'@inazria/data depends on nothing else in the workspace and no UI or host APIs.'
			)
		}
	},
	{
		files: ['packages/engine/**'],
		rules: {
			'no-restricted-imports': banImports(
				[...uiAndHostPackages, '@inazria/sim', '@inazria/render'],
				'@inazria/engine is pure: it may only import @inazria/data.'
			)
		}
	},
	{
		files: ['packages/sim/**'],
		rules: {
			'no-restricted-imports': banImports(
				['svelte', 'pixi.js', 'dexie', '@inazria/render'],
				'@inazria/sim runs engines in workers; it does not touch the UI, renderer or storage.'
			)
		}
	},
	{
		files: ['packages/render/**'],
		rules: {
			'no-restricted-imports': banImports(
				['svelte', 'dexie', 'comlink', '@inazria/sim'],
				'@inazria/render only draws engine setups and events with PixiJS.'
			)
		}
	},
	{
		files: ['apps/web/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: '$app/stores', message: 'Removed in SvelteKit 3. Use `$app/state`.' },
						{ name: '$app/environment', message: 'Renamed in SvelteKit 3. Use `$app/env`.' },
						{ name: '$service-worker', message: 'Removed in SvelteKit 3. See `$app/manifest`.' },
						{
							name: 'svelte/store',
							message: 'Use a class with `$state` fields in a `.svelte.ts` module.'
						},
						{ name: 'pixi.js', message: 'Only @inazria/render imports PixiJS.' }
					],
					patterns: [
						{ group: ['$lib', '$lib/*'], message: 'Use `#lib/...` with a file extension.' },
						{
							group: ['$env/*'],
							message: 'Use `$app/env/public` (no private env on a static site).'
						},
						{
							group: ['@inazria/*/src', '@inazria/*/src/*'],
							message: 'Import packages by name through their public exports.'
						}
					]
				}
			]
		}
	}
);
