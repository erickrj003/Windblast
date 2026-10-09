import { err, ok, type Result } from './result.ts';

interface Range {
	readonly start: number;
	readonly end: number;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM_LABEL = /^(\s*)[-*+]\s+\*\*(.+?)\*\*/;
const TABLE_ROW_LABEL = /^\s*\|\s*\*\*(.+?)\*\*\s*\|/;

const indentOf = (line: string): number => line.length - line.trimStart().length;

function headingRange(lines: ReadonlyArray<string>, at: number, level: number, end: number): Range {
	for (let index = at + 1; index < end; index += 1) {
		const match = HEADING.exec(lines[index] ?? '');
		if (match?.[1] !== undefined && match[1].length <= level) return { start: at, end: index };
	}
	return { start: at, end };
}

function listItemRange(lines: ReadonlyArray<string>, at: number, end: number): Range {
	const indent = indentOf(lines[at] ?? '');
	let last = at;
	for (let index = at + 1; index < end; index += 1) {
		const line = lines[index] ?? '';
		if (line.trim() === '') continue;
		if (indentOf(line) <= indent) break;
		last = index;
	}
	return { start: at, end: last + 1 };
}

function findComponent(
	lines: ReadonlyArray<string>,
	within: Range,
	name: string,
	isLast: boolean
): Result<Range, string> {
	const headings: Range[] = [];
	for (let index = within.start; index < within.end; index += 1) {
		const match = HEADING.exec(lines[index] ?? '');
		if (match?.[1] !== undefined && match[2] === name) {
			headings.push(headingRange(lines, index, match[1].length, within.end));
		}
	}
	const [heading, ...others] = headings;
	if (heading !== undefined) {
		return others.length === 0
			? ok(heading)
			: err(`"${name}" matches ${String(headings.length)} headings; add a parent heading`);
	}
	if (!isLast) return err(`no heading "${name}"`);

	const items: Range[] = [];
	for (let index = within.start; index < within.end; index += 1) {
		const line = lines[index] ?? '';
		if (LIST_ITEM_LABEL.exec(line)?.[2] === name)
			items.push(listItemRange(lines, index, within.end));
		else if (TABLE_ROW_LABEL.exec(line)?.[1] === name) items.push({ start: index, end: index + 1 });
	}
	const [item, ...rest] = items;
	if (item === undefined) return err(`no heading, bold list item or table row "${name}"`);
	return rest.length === 0
		? ok(item)
		: err(`"${name}" matches ${String(items.length)} items; add a parent heading`);
}

/**
 * Finds the text a `source.section` cites in a guide page. A section is a path of names joined
 * by ` > `: each name is a heading inside the previous one, and the last may instead be the
 * bold label of a list item (`- **Exertion (1st Level)**. …`, with its nested lines) or of a
 * table row (`| **Cleave** | … |`). The match must be unique. The returned text has LF line
 * endings, no trailing spaces and no surrounding blank lines, so its hash ignores formatting
 * noise but not wording.
 */
export function extractSection(markdown: string, section: string): Result<string, string> {
	const lines = markdown.replaceAll('\r\n', '\n').split('\n');
	const names = section.split(' > ').map((name) => name.trim());
	let range: Range = { start: 0, end: lines.length };
	for (const [index, name] of names.entries()) {
		if (name === '') return err(`Section "${section}" has an empty name`);
		const found = findComponent(lines, range, name, index === names.length - 1);
		if (!found.ok) return err(`Section "${section}": ${found.error}`);
		range = found.value;
	}
	const text = lines
		.slice(range.start, range.end)
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
	return ok(text);
}
