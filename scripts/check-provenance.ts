/**
 * `pnpm data:provenance`: re-hashes the guide section that every Inazria record cites, using the
 * vendored copy in packages/data/vendor/inazria/, and fails with a re-verify list when the text
 * changed or can no longer be found.
 *
 * Usage:
 *   node scripts/check-provenance.ts
 *   node scripts/check-provenance.ts --hash <page> "<section>"   print the source block to cite
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { extractSection, type Result } from '../packages/data/src/index.ts';

const DATA_DIR = join('packages', 'data');
const VENDOR_DIR = join(DATA_DIR, 'vendor', 'inazria');
const RECORDS_DIR = join(DATA_DIR, 'content', 'inazria');

interface Citation {
	readonly kind: string;
	readonly page: string;
	readonly section: string;
	readonly commit?: string;
	readonly contentHash?: string;
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

async function pinnedCommit(): Promise<string> {
	const file = join(VENDOR_DIR, 'SOURCE.json');
	if (!existsSync(file)) throw new Error('No vendored guide. Run `pnpm data:pull` first.');
	const pin = JSON.parse(await readFile(file, 'utf8')) as { readonly commit: string };
	return pin.commit;
}

async function hashSection(page: string, section: string): Promise<Result<string, string>> {
	const file = join(VENDOR_DIR, `${page}.md`);
	if (!existsSync(file)) return { ok: false, error: `page "${page}" is not in the vendored guide` };
	const text = extractSection(await readFile(file, 'utf8'), section);
	return text.ok ? { ok: true, value: sha256(text.value) } : text;
}

async function listJson(dir: string): Promise<string[]> {
	if (!existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await listJson(full)));
		else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
	}
	return files.sort();
}

async function printCitation(page: string, section: string): Promise<void> {
	const hash = await hashSection(page, section);
	if (!hash.ok) {
		console.error(hash.error);
		process.exit(1);
	}
	const citation = {
		kind: 'inazria',
		page,
		section,
		commit: await pinnedCommit(),
		contentHash: hash.value
	};
	console.info(JSON.stringify(citation, null, '\t'));
}

async function checkAll(): Promise<void> {
	const commit = await pinnedCommit();
	const files = await listJson(RECORDS_DIR);
	const reverify: string[] = [];
	let stalePins = 0;

	for (const file of files) {
		const name = relative(DATA_DIR, file).split(sep).join('/');
		const record = JSON.parse(await readFile(file, 'utf8')) as { readonly source?: Citation };
		const source = record.source;
		if (source?.kind !== 'inazria') continue;
		const cited = `${source.page}#${source.section}`;
		const hash = await hashSection(source.page, source.section);
		if (!hash.ok) reverify.push(`${name}: ${cited}: ${hash.error}`);
		else if (hash.value !== source.contentHash) {
			reverify.push(`${name}: ${cited}: text changed (now ${hash.value})`);
		} else if (source.commit !== commit) stalePins += 1;
	}

	console.info(
		`data:provenance: ${String(files.length)} Inazria records checked against ${commit}.`
	);
	if (stalePins > 0) {
		console.info(
			`${String(stalePins)} record(s) cite an older commit with unchanged text; update their pin when convenient.`
		);
	}
	if (reverify.length > 0) {
		console.error('Re-verify these records against the guide, then update their source block:');
		for (const line of reverify) console.error(`  ${line}`);
		process.exit(1);
	}
}

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { hash: { type: 'boolean' } }
});
const [page, section] = positionals;
if (values.hash === true) {
	if (page === undefined || section === undefined) {
		console.error('Usage: node scripts/check-provenance.ts --hash <page> "<section>"');
		process.exit(1);
	}
	await printCitation(page, section);
} else {
	await checkAll();
}
