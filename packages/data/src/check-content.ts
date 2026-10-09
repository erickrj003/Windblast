import * as v from 'valibot';
import { CONTENT_ROOTS, CONTENT_SCHEMAS } from './schemas/index.ts';

/** One content file, with its path relative to `packages/data/content/` using `/` separators. */
export interface ContentFile {
	readonly path: string;
	readonly text: string;
}

export interface ContentProblem {
	readonly path: string;
	readonly message: string;
}

export interface ContentReport {
	readonly problems: ReadonlyArray<ContentProblem>;
	/** Valid records per content kind, sorted by kind. */
	readonly counts: ReadonlyArray<readonly [kind: string, count: number]>;
}

const isKey = <T extends object>(object: T, key: string): key is Extract<keyof T, string> =>
	Object.hasOwn(object, key);

/**
 * Validates content files: each must sit at `<srd|inazria>/<kind>/<id>.json`, parse as JSON,
 * satisfy the schema for its kind, use its file name as `id`, cite a source matching its top
 * folder, and have an id unique within its kind.
 */
export function checkContent(files: ReadonlyArray<ContentFile>): ContentReport {
	const problems: ContentProblem[] = [];
	const counts = new Map<string, number>();
	const seen = new Map<string, string>();

	for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
		const report = (message: string): void => {
			problems.push({ path: file.path, message });
		};
		const parts = file.path.split('/');
		const [root, kind, name] = parts;
		if (parts.length !== 3 || root === undefined || kind === undefined || name === undefined) {
			report('Content files belong at <srd|inazria>/<kind>/<id>.json');
			continue;
		}
		if (!isKey(CONTENT_ROOTS, root)) {
			report(`Unknown content root "${root}"; expected ${Object.keys(CONTENT_ROOTS).join(' or ')}`);
			continue;
		}
		if (!isKey(CONTENT_SCHEMAS, kind)) {
			report(
				`Unknown content kind "${kind}"; expected one of ${Object.keys(CONTENT_SCHEMAS).join(', ')}`
			);
			continue;
		}
		if (!name.endsWith('.json')) {
			report('Content files must be .json');
			continue;
		}

		let json: unknown;
		try {
			json = JSON.parse(file.text);
		} catch (error) {
			report(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}

		const result = v.safeParse(CONTENT_SCHEMAS[kind], json);
		if (!result.success) {
			for (const issue of result.issues) {
				const at = v.getDotPath(issue);
				report(at === null ? issue.message : `${at}: ${issue.message}`);
			}
			continue;
		}

		const record = result.output;
		const id = name.slice(0, -'.json'.length);
		if (record.id !== id) report(`id "${record.id}" must match the file name "${id}"`);
		if (record.source.kind !== CONTENT_ROOTS[root]) {
			report(`Records under ${root}/ must cite source.kind "${CONTENT_ROOTS[root]}"`);
		}
		const key = `${kind}/${record.id}`;
		const earlier = seen.get(key);
		if (earlier === undefined) seen.set(key, file.path);
		else report(`Duplicate ${kind} id "${record.id}" (also in ${earlier})`);

		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}

	return { problems, counts: [...counts].sort(([a], [b]) => (a < b ? -1 : 1)) };
}
