/**
 * Fails if the JavaScript the first page loads exceeds the budget in the build plan
 * (under 200 KB gzipped, excluding PixiJS).
 *
 * Reads apps/web/build/index.html, collects every script it preloads or imports, then follows
 * static imports through the chunks. Dynamic `import()` calls are not followed: code loaded on
 * demand (PixiJS included) is not part of the first page.
 *
 * Usage (after `pnpm --filter web build`):
 *   node scripts/check-bundle-size.ts
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_DIR = resolve('apps', 'web', 'build');
const BUDGET_BYTES = 200 * 1024;

const HTML_SCRIPT = /["'`](\.?\/?_app\/[^"'`]+\.js)["'`]/g;
const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["']([^"']+\.js)["']/g;

async function main(): Promise<void> {
	let html: string;
	try {
		html = await readFile(join(BUILD_DIR, 'index.html'), 'utf8');
	} catch {
		console.error('No build found at apps/web/build. Run `pnpm --filter web build` first.');
		process.exit(1);
	}

	const pending = [...html.matchAll(HTML_SCRIPT)].map((match) =>
		resolve(BUILD_DIR, match[1] ?? '')
	);
	const sizes = new Map<string, number>();

	for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
		if (sizes.has(file)) continue;
		const source = await readFile(file);
		sizes.set(file, gzipSync(source).length);
		for (const match of source.toString('utf8').matchAll(STATIC_IMPORT)) {
			pending.push(resolve(dirname(file), match[1] ?? ''));
		}
	}

	const total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
	const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
	for (const [file, size] of [...sizes].sort((a, b) => b[1] - a[1])) {
		console.info(`${kb(size).padStart(10)}  ${relative(BUILD_DIR, file)}`);
	}
	console.info(`First-page JavaScript: ${kb(total)} gzipped (budget ${kb(BUDGET_BYTES)}).`);

	if (total >= BUDGET_BYTES) {
		console.error('Over budget. Lazy-load the heavy code or record a decision before raising it.');
		process.exit(1);
	}
}

await main();
