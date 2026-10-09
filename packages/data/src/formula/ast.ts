import type { AbilityId } from '../vocabulary.ts';

/**
 * Named values a formula can read when the engine evaluates it:
 * - `pb`: the creature's proficiency bonus
 * - `level`: total character level
 * - `pool-max`: the maximum of the resource pool being recharged
 * - `weapon-die`: the number of sides of the wielded weapon's damage die
 * - `speed`: the creature's current walking speed, in feet
 */
export const FORMULA_REFS = ['pb', 'level', 'pool-max', 'weapon-die', 'speed'] as const;
export type FormulaRef = (typeof FORMULA_REFS)[number];

export const FORMULA_FUNCTIONS = ['min', 'max', 'floor', 'ceil'] as const;
export type FormulaFunction = (typeof FORMULA_FUNCTIONS)[number];

export type BinaryOperator = '+' | '-' | '*' | '/';

/**
 * A parsed amount such as `1d10 + level(fighter)`. Built at data-check and compile time, never
 * while a trial runs. Division is exact; the engine rounds the final result down unless the
 * formula says `ceil`, following the SRD's "round down" convention.
 */
export type Formula =
	| { readonly kind: 'number'; readonly value: number }
	| { readonly kind: 'dice'; readonly count: Formula; readonly sides: Formula }
	| { readonly kind: 'ref'; readonly name: FormulaRef }
	| { readonly kind: 'classLevel'; readonly classId: string }
	| { readonly kind: 'mod'; readonly ability: AbilityId }
	| { readonly kind: 'table'; readonly column: string }
	| { readonly kind: 'negate'; readonly operand: Formula }
	| {
			readonly kind: 'binary';
			readonly op: BinaryOperator;
			readonly left: Formula;
			readonly right: Formula;
	  }
	| {
			readonly kind: 'call';
			readonly fn: FormulaFunction;
			readonly args: ReadonlyArray<Formula>;
	  };
