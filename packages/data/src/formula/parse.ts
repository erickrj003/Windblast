import { err, ok, type Result } from '../result.ts';
import { ABILITIES, type AbilityId } from '../vocabulary.ts';
import type { BinaryOperator, Formula, FormulaRef } from './ast.ts';

type Punct = '(' | ')' | ',' | '+' | '-' | '*' | '/';

type Token =
	| { readonly kind: 'number'; readonly value: number; readonly at: number }
	| { readonly kind: 'dice'; readonly count: number; readonly sides: number; readonly at: number }
	| { readonly kind: 'ident'; readonly name: string; readonly at: number }
	| { readonly kind: 'punct'; readonly char: Punct; readonly at: number }
	| { readonly kind: 'end'; readonly at: number };

const TOKEN = /\s*(?:(\d*)d(\d+)(?![a-z0-9-])|(\d+)|([a-z][a-z0-9]*(?:-[a-z0-9]+)*)|([(),+\-*/]))/y;
const TRAILING_SPACE = /\s*$/y;
const MAX_LITERAL = 1_000_000;

class FormulaSyntaxError extends Error {}

function tokenize(text: string): ReadonlyArray<Token> {
	const tokens: Token[] = [];
	let index = 0;
	for (;;) {
		TRAILING_SPACE.lastIndex = index;
		if (TRAILING_SPACE.test(text)) {
			tokens.push({ kind: 'end', at: text.length });
			return tokens;
		}
		TOKEN.lastIndex = index;
		const match = TOKEN.exec(text);
		if (match === null) {
			const at = index + (/^\s*/.exec(text.slice(index))?.[0].length ?? 0);
			throw new FormulaSyntaxError(`unexpected character "${text.charAt(at)}" at ${String(at)}`);
		}
		const [whole, diceCount, diceSides, number, ident, punct] = match;
		const at = index + whole.length - whole.trimStart().length;
		if (diceSides !== undefined) {
			const count = diceCount === undefined || diceCount === '' ? 1 : Number(diceCount);
			tokens.push({ kind: 'dice', count, sides: Number(diceSides), at });
		} else if (number !== undefined) {
			tokens.push({ kind: 'number', value: Number(number), at });
		} else if (ident !== undefined) {
			tokens.push({ kind: 'ident', name: ident, at });
		} else {
			tokens.push({ kind: 'punct', char: punct as Punct, at });
		}
		index = TOKEN.lastIndex;
	}
}

const isAbility = (name: string): name is AbilityId =>
	(ABILITIES as ReadonlyArray<string>).includes(name);

const BARE_REFS: ReadonlyMap<string, FormulaRef> = new Map([
	['pb', 'pb'],
	['level', 'level'],
	['pool-max', 'pool-max'],
	['weapon-die', 'weapon-die']
]);

class Parser {
	private readonly tokens: ReadonlyArray<Token>;
	private index = 0;

	constructor(tokens: ReadonlyArray<Token>) {
		this.tokens = tokens;
	}

	parse(): Formula {
		const formula = this.sum();
		const next = this.peek();
		if (next.kind !== 'end') this.fail(next, 'an operator or the end of the formula');
		return formula;
	}

	private peek(): Token {
		const token = this.tokens[this.index];
		if (token === undefined) throw new Error('Formula tokens must end with an end token');
		return token;
	}

	private advance(): Token {
		const token = this.peek();
		if (token.kind !== 'end') this.index += 1;
		return token;
	}

	private isPunct(char: Punct): boolean {
		const token = this.peek();
		return token.kind === 'punct' && token.char === char;
	}

	private expectPunct(char: Punct): void {
		const token = this.advance();
		if (token.kind !== 'punct' || token.char !== char) this.fail(token, `"${char}"`);
	}

	private expectIdent(what: string): string {
		const token = this.advance();
		if (token.kind !== 'ident') this.fail(token, what);
		return token.name;
	}

	private fail(token: Token, expected: string): never {
		const found = token.kind === 'end' ? 'the end of the formula' : `token at ${String(token.at)}`;
		throw new FormulaSyntaxError(`expected ${expected} but found ${found}`);
	}

	private sum(): Formula {
		let left = this.product();
		while (this.isPunct('+') || this.isPunct('-')) {
			const op: BinaryOperator = this.isPunct('+') ? '+' : '-';
			this.advance();
			left = { kind: 'binary', op, left, right: this.product() };
		}
		return left;
	}

	private product(): Formula {
		let left = this.unary();
		while (this.isPunct('*') || this.isPunct('/')) {
			const op: BinaryOperator = this.isPunct('*') ? '*' : '/';
			this.advance();
			left = { kind: 'binary', op, left, right: this.unary() };
		}
		return left;
	}

	private unary(): Formula {
		if (this.isPunct('-')) {
			this.advance();
			return { kind: 'negate', operand: this.unary() };
		}
		return this.atom();
	}

	private atom(): Formula {
		const token = this.advance();
		switch (token.kind) {
			case 'number':
				checkLiteral(token.value, 0, token.at);
				return { kind: 'number', value: token.value };
			case 'dice':
				checkLiteral(token.count, 1, token.at);
				checkLiteral(token.sides, 2, token.at);
				return {
					kind: 'dice',
					count: { kind: 'number', value: token.count },
					sides: { kind: 'number', value: token.sides }
				};
			case 'ident':
				return this.named(token.name, token.at);
			case 'punct':
				if (token.char === '(') {
					const inner = this.sum();
					this.expectPunct(')');
					return inner;
				}
				return this.fail(token, 'a number, dice, name or "("');
			case 'end':
				return this.fail(token, 'a number, dice, name or "("');
			default:
				return assertNeverToken(token);
		}
	}

	private named(name: string, at: number): Formula {
		const hasArgs = this.isPunct('(');
		switch (name) {
			case 'min':
			case 'max':
				return { kind: 'call', fn: name, args: this.args(2, Infinity) };
			case 'floor':
			case 'ceil':
				return { kind: 'call', fn: name, args: this.args(1, 1) };
			case 'dice': {
				const [count, sides] = this.args(2, 2);
				if (count === undefined || sides === undefined)
					throw new Error('args(2, 2) returned too few');
				return { kind: 'dice', count, sides };
			}
			case 'mod': {
				const ability = this.identArg('an ability (str, dex, con, int, wis or cha)');
				if (!isAbility(ability))
					throw new FormulaSyntaxError(`unknown ability "${ability}" at ${String(at)}`);
				return { kind: 'mod', ability };
			}
			case 'table':
				return { kind: 'table', column: this.identArg('a class table column id') };
			case 'level':
				if (hasArgs) return { kind: 'classLevel', classId: this.identArg('a class id') };
				return { kind: 'ref', name: 'level' };
			default: {
				const ref = BARE_REFS.get(name);
				if (ref === undefined || hasArgs) {
					throw new FormulaSyntaxError(`unknown name "${name}" at ${String(at)}`);
				}
				return { kind: 'ref', name: ref };
			}
		}
	}

	private identArg(what: string): string {
		this.expectPunct('(');
		const name = this.expectIdent(what);
		this.expectPunct(')');
		return name;
	}

	private args(min: number, max: number): ReadonlyArray<Formula> {
		this.expectPunct('(');
		const args = [this.sum()];
		while (this.isPunct(',')) {
			this.advance();
			args.push(this.sum());
		}
		this.expectPunct(')');
		if (args.length < min || args.length > max) {
			const range = max === Infinity ? `at least ${String(min)}` : String(min);
			throw new FormulaSyntaxError(`expected ${range} argument(s), got ${String(args.length)}`);
		}
		return args;
	}
}

function checkLiteral(value: number, min: number, at: number): void {
	if (value < min || value > MAX_LITERAL) {
		throw new FormulaSyntaxError(`number ${String(value)} at ${String(at)} is out of range`);
	}
}

function assertNeverToken(token: never): never {
	throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
}

/**
 * Parses a formula string such as `1d10 + level(fighter)` or `max(1, mod(cha))`.
 *
 * Grammar: `+ -` (lowest), `* /`, unary `-`, then numbers, dice (`2d6`, `d20`), names
 * (`pb`, `level`, `pool-max`, `weapon-die`), calls (`min`, `max`, `floor`, `ceil`, `dice`,
 * `mod(<ability>)`, `level(<class>)`, `table(<column>)`) and parentheses.
 */
export function parseFormula(text: string): Result<Formula, string> {
	try {
		return ok(new Parser(tokenize(text)).parse());
	} catch (error) {
		if (error instanceof FormulaSyntaxError)
			return err(`Invalid formula "${text}": ${error.message}`);
		throw error;
	}
}
