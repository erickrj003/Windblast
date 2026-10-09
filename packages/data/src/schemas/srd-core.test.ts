import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Armor, Condition, DamageType, Weapon } from './index.ts';

const srd = (page: string, section: string) => ({ kind: 'srd51', page, section }) as const;

const without = (object: object, ...keys: ReadonlyArray<string>): Record<string, unknown> =>
	Object.fromEntries(Object.entries(object).filter(([name]) => !keys.includes(name)));

function messages(schema: v.GenericSchema<unknown, unknown>, input: unknown): string {
	const result = v.safeParse(schema, input);
	return result.success ? '' : result.issues.map((issue) => issue.message).join(' | ');
}

const longsword = {
	id: 'longsword',
	name: 'Longsword',
	source: srd('equipment', 'Weapons'),
	status: 'final',
	category: 'martial',
	type: 'melee',
	damage: { dice: '1d8', type: 'slashing' },
	versatile: '1d10',
	properties: ['versatile']
};

const dagger = {
	id: 'dagger',
	name: 'Dagger',
	source: srd('equipment', 'Weapons'),
	status: 'final',
	category: 'simple',
	type: 'melee',
	damage: { dice: '1d4', type: 'piercing' },
	range: { normal: 20, long: 60 },
	properties: ['finesse', 'light', 'thrown']
};

const net = {
	id: 'net',
	name: 'Net',
	source: srd('equipment', 'Weapons'),
	status: 'final',
	category: 'martial',
	type: 'ranged',
	range: { normal: 5, long: 15 },
	properties: ['special', 'thrown']
};

const chainMail = {
	id: 'chain-mail',
	name: 'Chain mail',
	source: srd('equipment', 'Armor'),
	status: 'final',
	category: 'heavy',
	armorClass: 16,
	dexterity: 'none',
	strength: 13,
	stealthDisadvantage: true
};

describe('Weapon [srd51:equipment#weapons]', () => {
	it('accepts versatile, thrown and damageless special weapons', () => {
		expect(messages(Weapon, longsword)).toBe('');
		expect(messages(Weapon, dagger)).toBe('');
		expect(messages(Weapon, net)).toBe('');
		expect(messages(Weapon, { ...longsword, damage: { dice: '1', type: 'piercing' } })).toBe('');
	});

	it('pairs the versatile property with its two-handed damage', () => {
		expect(messages(Weapon, { ...longsword, properties: [] })).toMatch(/versatile/);
		expect(messages(Weapon, { ...dagger, versatile: '1d6' })).toMatch(/versatile/);
	});

	it('requires a range exactly for ammunition and thrown weapons [srd51:equipment#weapon-properties]', () => {
		expect(messages(Weapon, without(dagger, 'range'))).toMatch(/range/);
		expect(messages(Weapon, { ...longsword, range: { normal: 20, long: 60 } })).toMatch(/range/);
		expect(messages(Weapon, { ...dagger, range: { normal: 60, long: 20 } })).toMatch(/long range/);
	});

	it('rejects ranged weapons that neither fire ammunition nor are thrown', () => {
		expect(
			messages(Weapon, { ...without(longsword, 'versatile'), type: 'ranged', properties: [] })
		).toMatch(/ranged/);
	});

	it('allows a weapon without damage only when its rules are special', () => {
		expect(messages(Weapon, { ...net, properties: ['thrown'] })).toMatch(/special/);
	});

	it('rejects duplicate properties, monster-style formulas and "range" as a property', () => {
		expect(messages(Weapon, { ...dagger, properties: ['light', 'light', 'thrown'] })).toMatch(
			/once/
		);
		expect(
			messages(Weapon, { ...dagger, damage: { dice: '1d4 + mod(dex)', type: 'piercing' } })
		).toMatch(/Stat block dice/);
		expect(messages(Weapon, { ...dagger, properties: ['range', 'thrown'] })).not.toBe('');
	});
});

describe('Armor [srd51:equipment#armor]', () => {
	it('accepts body armor and shields', () => {
		expect(messages(Armor, chainMail)).toBe('');
		expect(
			messages(Armor, {
				...without(chainMail, 'strength'),
				id: 'half-plate',
				category: 'medium',
				armorClass: 15,
				dexterity: { max: 2 }
			})
		).toBe('');
		expect(
			messages(Armor, {
				id: 'shield',
				name: 'Shield',
				source: srd('equipment', 'Armor'),
				status: 'final',
				category: 'shield',
				armorClassBonus: 2
			})
		).toBe('');
	});

	it('keeps body-armor fields off shields and requires a base AC on body armor', () => {
		expect(messages(Armor, { ...chainMail, category: 'shield', armorClassBonus: 2 })).not.toBe('');
		expect(messages(Armor, without(chainMail, 'armorClass'))).not.toBe('');
	});
});

describe('DamageType and Condition [srd51:conditions]', () => {
	it('accepts a damage type with its description', () => {
		expect(
			messages(DamageType, {
				id: 'fire',
				name: 'Fire',
				source: srd('combat', 'Damage Types'),
				status: 'final',
				description: 'Red dragons breathe fire, and many spells conjure flames to deal fire damage.'
			})
		).toBe('');
	});

	const paralyzed = {
		id: 'paralyzed',
		name: 'Paralyzed',
		source: srd('conditions', 'Paralyzed'),
		status: 'final',
		rules: [
			'A paralyzed creature is incapacitated (see the condition) and can’t move or speak.',
			'The creature automatically fails Strength and Dexterity saving throws.'
		],
		implies: ['incapacitated']
	};

	it('accepts a condition with its rules and the conditions it includes', () => {
		expect(messages(Condition, paralyzed)).toBe('');
		expect(messages(Condition, { ...paralyzed, levels: ['Disadvantage on ability checks'] })).toBe(
			''
		);
	});

	it('rejects empty rules, empty rule lines and a condition that includes itself', () => {
		expect(messages(Condition, { ...paralyzed, rules: [] })).not.toBe('');
		expect(messages(Condition, { ...paralyzed, rules: ['  '] })).not.toBe('');
		expect(messages(Condition, { ...paralyzed, implies: ['paralyzed'] })).toMatch(/itself/);
		expect(messages(Condition, { ...paralyzed, implies: ['prone', 'prone'] })).toMatch(/once/);
	});
});
