import { assertNever } from '../assert-never.ts';
import type { Formula } from './ast.ts';

const ATOM = 4;
const UNARY = 3;

function precedence(formula: Formula): number {
	if (formula.kind === 'binary') return formula.op === '+' || formula.op === '-' ? 1 : 2;
	if (formula.kind === 'negate') return UNARY;
	return ATOM;
}

function wrap(formula: Formula, needsParens: boolean): string {
	const text = formatFormula(formula);
	return needsParens ? `(${text})` : text;
}

/**
 * Writes a formula in canonical form. `parseFormula(formatFormula(f))` gives back `f`, which is
 * how compiled data and the review UI show the amounts the engine will use.
 */
export function formatFormula(formula: Formula): string {
	switch (formula.kind) {
		case 'number':
			return String(formula.value);
		case 'dice':
			return formula.count.kind === 'number' && formula.sides.kind === 'number'
				? `${String(formula.count.value)}d${String(formula.sides.value)}`
				: `dice(${formatFormula(formula.count)}, ${formatFormula(formula.sides)})`;
		case 'ref':
			return formula.name;
		case 'classLevel':
			return `level(${formula.classId})`;
		case 'mod':
			return `mod(${formula.ability})`;
		case 'table':
			return `table(${formula.column})`;
		case 'negate':
			return `-${wrap(formula.operand, precedence(formula.operand) < UNARY)}`;
		case 'binary': {
			const own = precedence(formula);
			const left = wrap(formula.left, precedence(formula.left) < own);
			const right = wrap(formula.right, precedence(formula.right) <= own);
			return `${left} ${formula.op} ${right}`;
		}
		case 'call':
			return `${formula.fn}(${formula.args.map(formatFormula).join(', ')})`;
		default:
			return assertNever(formula);
	}
}

/** True when a formula reads nothing from the creature, so it can stand alone (monster dice). */
export function isSelfContained(formula: Formula): boolean {
	switch (formula.kind) {
		case 'number':
			return true;
		case 'ref':
		case 'classLevel':
		case 'mod':
		case 'table':
			return false;
		case 'dice':
			return isSelfContained(formula.count) && isSelfContained(formula.sides);
		case 'negate':
			return isSelfContained(formula.operand);
		case 'binary':
			return isSelfContained(formula.left) && isSelfContained(formula.right);
		case 'call':
			return formula.args.every(isSelfContained);
		default:
			return assertNever(formula);
	}
}
