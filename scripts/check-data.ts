/**
 * `pnpm data:check`: validates every JSON record under packages/data/content/ with the
 * schemas in @inazria/data. Exits 1 and lists each problem if any record is invalid.
 *
 * Usage:
 *   node scripts/check-data.ts [content-dir]
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import {
	checkContent,
	missingInazriaRaces,
	missingStarterMonsters,
	type ContentFile
} from '../packages/data/src/index.ts';

const CONTENT_DIR = resolve(process.argv[2] ?? join('packages', 'data', 'content'));

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(full)));
		else if (entry.isFile() && entry.name !== '.gitkeep') files.push(full);
	}
	return files;
}

async function main(): Promise<void> {
	if (!existsSync(CONTENT_DIR)) {
		console.info(`data:check: no content directory at ${CONTENT_DIR}; nothing to validate.`);
		return;
	}
	const files: ContentFile[] = await Promise.all(
		(await listFiles(CONTENT_DIR)).map(async (file) => ({
			path: relative(CONTENT_DIR, file).split(sep).join('/'),
			text: await readFile(file, 'utf8')
		}))
	);

	const { problems, counts, scripts } = checkContent(files);
	for (const problem of problems) console.error(`${problem.path}: ${problem.message}`);
	const presentMonsters = new Set(
		files
			.filter((file) => /^srd\/monsters\/[^/]+\.json$/.test(file.path))
			.map((file) => file.path.slice('srd/monsters/'.length, -'.json'.length))
	);
	const missing = missingStarterMonsters(presentMonsters);
	for (const id of missing) {
		console.error(`srd/monsters/${id}.json: missing starter monster`);
	}
	const presentRaces = new Set(
		files
			.filter((file) => /^inazria\/races\/[^/]+\.json$/.test(file.path))
			.map((file) => file.path.slice('inazria/races/'.length, -'.json'.length))
	);
	const missingRaces = missingInazriaRaces(presentRaces);
	for (const id of missingRaces) {
		console.error(`inazria/races/${id}.json: missing published Inazria race`);
	}
	const summary = counts.map(([kind, count]) => `${String(count)} ${kind}`).join(', ');
	const scriptNote =
		scripts.length === 0 ? '' : `; ${String(scripts.length)} scriptId(s) for the engine`;
	console.info(
		`data:check: ${String(files.length)} files${summary === '' ? '' : ` (${summary})`}${scriptNote}.`
	);
	if (problems.length > 0 || missing.length > 0 || missingRaces.length > 0) {
		console.error(
			`data:check: ${String(problems.length + missing.length + missingRaces.length)} problem(s).`
		);
		process.exit(1);
	}
}

await main();
