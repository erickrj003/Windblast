import { defineConfig } from 'vitest/config';

const packages = ['data', 'engine', 'sim', 'render'] as const;

export default defineConfig({
	test: {
		// Inline projects inherit the root options below; directory globs would not.
		projects: packages.map((name) => ({
			extends: true,
			test: { name, include: [`packages/${name}/src/**/*.test.ts`] }
		})),
		allowOnly: false,
		coverage: {
			provider: 'v8',
			include: ['packages/*/src/**/*.ts'],
			exclude: ['**/*.test.ts', '**/*.bench.ts'],
			reporter: ['text', 'html'],
			// Minimums from .claude/rules/testing.md. Never lower them.
			thresholds: {
				'packages/engine/src/**': { lines: 90, branches: 85 },
				'packages/data/src/**': { lines: 85 },
				'packages/sim/src/**': { lines: 85 }
			}
		}
	}
});
