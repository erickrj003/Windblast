import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../vocabulary.ts';
import { FORMULA_REFS, type Formula } from './ast.ts';
import { formatFormula, isSelfContained } from './format.ts';
import { parseFormula } from './parse.ts';

function parsed(text: string): Formula {
	const result = parseFormula(text);
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

const num = (value: number): Formula => ({ kind: 'number', value });

describe('parseFormula', () => {
	it('parses plain dice with a bonus', () => {
		expect(parsed('2d6+3')).toEqual({
			kind: 'binary',
			op: '+',
			left: { kind: 'dice', count: num(2), sides: num(6) },
			right: num(3)
		});
	});

	it('reads "d20" as one die', () => {
		expect(parsed('d20')).toEqual({ kind: 'dice', count: num(1), sides: num(20) });
	});

	it('parses Second Wind healing [inazria:classes/civil/fighter#core-class-features]', () => {
		expect(parsed('1d10 + level(fighter)')).toEqual({
			kind: 'binary',
			op: '+',
			left: { kind: 'dice', count: num(1), sides: num(10) },
			right: { kind: 'classLevel', classId: 'fighter' }
		});
	});

	it('parses a rounded, floored modifier [inazria:classes/civil/fighter#champion]', () => {
		expect(parsed('max(1, ceil(mod(str) / 2))')).toEqual({
			kind: 'call',
			fn: 'max',
			args: [
				num(1),
				{
					kind: 'call',
					fn: 'ceil',
					args: [{ kind: 'binary', op: '/', left: { kind: 'mod', ability: 'str' }, right: num(2) }]
				}
			]
		});
	});

	it('parses dice whose size comes from a class table [inazria:classes/civil/savant#core-class-features]', () => {
		expect(parsed('dice(1, table(focus-die)) + mod(cha) + level(savant)')).toEqual({
			kind: 'binary',
			op: '+',
			left: {
				kind: 'binary',
				op: '+',
				left: { kind: 'dice', count: num(1), sides: { kind: 'table', column: 'focus-die' } },
				right: { kind: 'mod', ability: 'cha' }
			},
			right: { kind: 'classLevel', classId: 'savant' }
		});
	});

	it('binds * tighter than + and unary minus tighter than *', () => {
		expect(formatFormula(parsed('1 + 2 * -pb'))).toBe('1 + 2 * -pb');
		expect(parsed('-pb * 2')).toEqual({
			kind: 'binary',
			op: '*',
			left: { kind: 'negate', operand: { kind: 'ref', name: 'pb' } },
			right: num(2)
		});
	});

	it('reads bare names', () => {
		for (const name of FORMULA_REFS) expect(parsed(name)).toEqual({ kind: 'ref', name });
	});

	it('reads dice-shaped ids where only a name fits (fast-check seed 1803929684)', () => {
		expect(parsed('table(d0)')).toEqual({ kind: 'table', column: 'd0' });
		expect(parsed('level(d20)')).toEqual({ kind: 'classLevel', classId: 'd20' });
		expect(parseFormula('table(2d6)').ok).toBe(false);
	});

	it.each([
		['', 'expected a number'],
		['2d6 +', 'expected a number'],
		['2d6 3', 'expected an operator'],
		['(1 + 2', 'expected ")"'],
		['mod(strength)', 'unknown ability "strength"'],
		['mod(1)', 'expected an ability'],
		['wisdom', 'unknown name "wisdom"'],
		['pb(1)', 'unknown name "pb"'],
		['min(1)', 'at least 2 argument(s)'],
		['ceil(1, 2)', 'expected 1 argument(s)'],
		['0d6', 'out of range'],
		['1d1', 'out of range'],
		['2000000', 'out of range'],
		['2 % 3', 'unexpected character "%"'],
		['1 + 2 )', 'expected an operator']
	])('rejects %j', (text, message) => {
		const result = parseFormula(text);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain(message);
	});
});

describe('isSelfContained', () => {
	it('accepts monster dice and rejects anything that reads the creature', () => {
		expect(isSelfContained(parsed('2d8 + 4'))).toBe(true);
		expect(isSelfContained(parsed('max(1, 3 - 4) * (2 / 1)'))).toBe(true);
		expect(isSelfContained(parsed('-2'))).toBe(true);
		expect(isSelfContained(parsed('1d8 + mod(str)'))).toBe(false);
		expect(isSelfContained(parsed('dice(table(sneak-attack-dice), 6)'))).toBe(false);
		expect(isSelfContained(parsed('dice(2, weapon-die)'))).toBe(false);
		expect(isSelfContained(parsed('-pb'))).toBe(false);
		expect(isSelfContained(parsed('min(1, level(fighter))'))).toBe(false);
	});
});

const kebab = fc.stringMatching(/^[a-z][a-z0-9]{0,6}(?:-[a-z0-9]{1,4}){0,2}$/);

const { formula: formulaArbitrary } = fc.letrec<{ formula: Formula }>((tie) => ({
	formula: fc.oneof(
		{ depthSize: 'small', withCrossShrink: true },
		fc.nat({ max: 1000 }).map(num),
		fc
			.record({ count: fc.integer({ min: 1, max: 20 }), sides: fc.integer({ min: 2, max: 100 }) })
			.map(({ count, sides }): Formula => ({ kind: 'dice', count: num(count), sides: num(sides) })),
		fc.constantFrom(...FORMULA_REFS).map((name): Formula => ({ kind: 'ref', name })),
		fc.constantFrom(...ABILITIES).map((ability): Formula => ({ kind: 'mod', ability })),
		kebab.map((classId): Formula => ({ kind: 'classLevel', classId })),
		kebab.map((column): Formula => ({ kind: 'table', column })),
		tie('formula').map((operand): Formula => ({ kind: 'negate', operand })),
		fc
			.record({
				op: fc.constantFrom('+' as const, '-' as const, '*' as const, '/' as const),
				left: tie('formula'),
				right: tie('formula')
			})
			.map((node): Formula => ({ kind: 'binary', ...node })),
		fc
			.record({ count: tie('formula'), sides: tie('formula') })
			.filter(({ count, sides }) => !(count.kind === 'number' && sides.kind === 'number'))
			.map((node): Formula => ({ kind: 'dice', ...node })),
		fc
			.tuple(
				fc.constantFrom('min' as const, 'max' as const),
				fc.array(tie('formula'), { minLength: 2, maxLength: 3 })
			)
			.map(([fn, args]): Formula => ({ kind: 'call', fn, args })),
		fc
			.tuple(fc.constantFrom('floor' as const, 'ceil' as const), tie('formula'))
			.map(([fn, arg]): Formula => ({ kind: 'call', fn, args: [arg] }))
	)
}));

describe('formatFormula', () => {
	it('round-trips through parseFormula for any formula (property)', () => {
		fc.assert(
			fc.property(formulaArbitrary, (formula) => {
				expect(parsed(formatFormula(formula))).toEqual(formula);
			})
		);
	});

	it('writes literal dice compactly and computed dice as a call', () => {
		expect(formatFormula(parsed('dice(2, 6)'))).toBe('2d6');
		expect(formatFormula(parsed('dice(table(sneak-attack-dice), 6)'))).toBe(
			'dice(table(sneak-attack-dice), 6)'
		);
	});

	it('adds only the parentheses the structure needs', () => {
		expect(formatFormula(parsed('(1 + 2) + 3'))).toBe('1 + 2 + 3');
		expect(formatFormula(parsed('1 + (2 + 3)'))).toBe('1 + (2 + 3)');
		expect(formatFormula(parsed('(1 - 2) * 3'))).toBe('(1 - 2) * 3');
		expect(formatFormula(parsed('-(pb + 1)'))).toBe('-(pb + 1)');
	});
});
