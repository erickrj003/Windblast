/**
 * `pnpm data:pull`: copies the Inazria Player's Guide pages (content/**\/*.md) at a pinned commit
 * into packages/data/vendor/inazria/ and records the commit in SOURCE.json.
 *
 * Usage:
 *   node scripts/pull-inazria.ts               re-pull the commit pinned in SOURCE.json
 *   node scripts/pull-inazria.ts --ref v5      move the pin to the tip of a branch, or to a SHA
 *
 * Never edit vendored files by hand; re-pull instead. Only the public guide repo is read.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';

const REPOSITORY = 'https://github.com/erickrj003/inazria-players-guide.git';
const BRANCH = 'v5';
const GUIDE_DIR = 'content';
const VENDOR_DIR = join('packages', 'data', 'vendor', 'inazria');
const SOURCE_FILE = join(VENDOR_DIR, 'SOURCE.json');

interface SourcePin {
	readonly repository: string;
	readonly branch: string;
	readonly commit: string;
	readonly path: string;
}

function git(cwd: string, ...args: ReadonlyArray<string>): string {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

async function readPin(): Promise<SourcePin | undefined> {
	if (!existsSync(SOURCE_FILE)) return undefined;
	return JSON.parse(await readFile(SOURCE_FILE, 'utf8')) as SourcePin;
}

async function listMarkdown(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await listMarkdown(full)));
		else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
	}
	return files.sort();
}

async function main(): Promise<void> {
	const { values } = parseArgs({ options: { ref: { type: 'string' } } });
	const pin = await readPin();
	const ref = values.ref ?? pin?.commit ?? BRANCH;

	const work = await mkdtemp(join(tmpdir(), 'inazria-guide-'));
	try {
		const checkout = join(work, 'guide');
		git(work, 'clone', '--quiet', '--filter=blob:none', '--no-checkout', REPOSITORY, checkout);
		git(checkout, 'sparse-checkout', 'set', GUIDE_DIR);
		const commit = /^[0-9a-f]{40}$/.test(ref) ? ref : git(checkout, 'rev-parse', `origin/${ref}`);
		git(checkout, 'checkout', '--quiet', '--detach', commit);

		const source = join(checkout, GUIDE_DIR);
		const pages = await listMarkdown(source);
		await rm(VENDOR_DIR, { recursive: true, force: true });
		for (const page of pages) {
			const target = join(VENDOR_DIR, relative(source, page));
			await mkdir(dirname(target), { recursive: true });
			await cp(page, target);
		}
		const next: SourcePin = { repository: REPOSITORY, branch: BRANCH, commit, path: GUIDE_DIR };
		await writeFile(SOURCE_FILE, `${JSON.stringify(next, null, '\t')}\n`);

		const moved =
			pin === undefined ? 'new pin' : pin.commit === commit ? 'pin unchanged' : `was ${pin.commit}`;
		console.info(`data:pull: ${String(pages.length)} pages at ${commit} (${moved}).`);
		if (pin !== undefined && pin.commit !== commit) {
			console.info('Run `pnpm data:provenance` to list records whose cited text changed.');
		}
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

await main();
