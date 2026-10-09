import { describe, expect, it } from 'vitest';
import { checkContent, type ContentFile } from './check-content.ts';

const pool = (id: string, kind: 'srd51' | 'inazria'): string =>
	JSON.stringify({
		id,
		name: 'Test Pool',
		source:
			kind === 'srd51'
				? { kind, page: 'combat', section: 'Actions in Combat' }
				: {
						kind,
						page: 'classes/civil/fighter',
						section: 'Exertion',
						commit: '0'.repeat(40),
						contentHash: '0'.repeat(64)
					},
		status: 'final',
		max: 'pb',
		recharge: [{ on: 'longRest', regain: 'pool-max' }]
	});

const file = (path: string, text: string): ContentFile => ({ path, text });

describe('checkContent', () => {
	it('passes valid records and counts them per kind', () => {
		const report = checkContent([
			file('inazria/resources/exertion.json', pool('exertion', 'inazria')),
			file('srd/resources/reaction.json', pool('reaction', 'srd51'))
		]);
		expect(report.problems).toEqual([]);
		expect(report.counts).toEqual([['resources', 2]]);
	});

	it('passes an empty content folder', () => {
		expect(checkContent([])).toEqual({ problems: [], counts: [] });
	});

	it.each([
		['srd/exertion.json', pool('exertion', 'srd51'), 'belong at <srd|inazria>/<kind>/<id>.json'],
		['phb/resources/x.json', pool('x', 'srd51'), 'Unknown content root "phb"'],
		['srd/spells/x.json', pool('x', 'srd51'), 'Unknown content kind "spells"'],
		['srd/resources/x.yaml', pool('x', 'srd51'), 'must be .json'],
		['srd/resources/x.json', '{ "id": ', 'Invalid JSON'],
		['srd/resources/x.json', pool('y', 'srd51'), 'id "y" must match the file name "x"'],
		['srd/resources/x.json', pool('x', 'inazria'), 'must cite source.kind "srd51"']
	])('reports %s', (path, text, message) => {
		const { problems } = checkContent([file(path, text)]);
		expect(problems).toHaveLength(1);
		expect(problems[0]?.path).toBe(path);
		expect(problems[0]?.message).toContain(message);
	});

	it('reports schema issues with the path of the bad field', () => {
		const broken = {
			...(JSON.parse(pool('x', 'srd51')) as object),
			recharge: [{ on: 'dawn', regain: 'pool-max' }]
		};
		const { problems } = checkContent([file('srd/resources/x.json', JSON.stringify(broken))]);
		expect(problems.map((problem) => problem.message)).toEqual([
			expect.stringMatching(/^recharge\.0\.on: /)
		]);
	});

	it('reports a non-object record without a field path', () => {
		const { problems } = checkContent([file('srd/resources/x.json', '42')]);
		expect(problems[0]?.message).toMatch(/^Invalid type/);
	});

	it('rejects the same id in one kind across both roots', () => {
		const { problems } = checkContent([
			file('srd/resources/shared.json', pool('shared', 'srd51')),
			file('inazria/resources/shared.json', pool('shared', 'inazria'))
		]);
		expect(problems).toEqual([
			{
				path: 'srd/resources/shared.json',
				message: 'Duplicate resources id "shared" (also in inazria/resources/shared.json)'
			}
		]);
	});
});
