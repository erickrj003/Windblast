import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertNever } from './assert-never.ts';

type Shape = { readonly kind: 'circle' } | { readonly kind: 'square' };

function describeShape(shape: Shape): string {
	switch (shape.kind) {
		case 'circle':
			return 'round';
		case 'square':
			return 'four corners';
		default:
			return assertNever(shape);
	}
}

describe('assertNever', () => {
	it('is unreachable for every member of an exhaustively handled union', () => {
		expect(describeShape({ kind: 'circle' })).toBe('round');
		expect(describeShape({ kind: 'square' })).toBe('four corners');
	});

	it('throws a descriptive error when an unexpected value reaches it at runtime', () => {
		const corrupted = { kind: 'triangle' } as unknown as Shape;
		expect(() => describeShape(corrupted)).toThrow('Unexpected value: {"kind":"triangle"}');
	});

	it('throws for any value at all (property)', () => {
		fc.assert(
			fc.property(fc.jsonValue(), (value) => {
				expect(() => assertNever(value as never)).toThrow(/^Unexpected value: /);
			})
		);
	});
});
