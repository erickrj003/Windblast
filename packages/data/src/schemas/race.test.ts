import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Grant, Race } from './index.ts';

const COMMIT = '23a5f30fff291f77e01939feea769ecedad57446';
const HASH = 'a'.repeat(64);

const source = (page: string, section: string) => ({
	kind: 'inazria' as const,
	page,
	section,
	commit: COMMIT,
	contentHash: HASH
});

function messages(schema: v.GenericSchema<unknown, unknown>, input: unknown): string {
	const result = v.safeParse(schema, input);
	return result.success ? '' : result.issues.map((issue) => issue.message).join(' | ');
}

const noEffect = (id: string, name: string, reason: string) => ({
	id,
	name,
	summary: name,
	cost: 'none',
	effects: [],
	noEffect: reason
});

const human = {
	id: 'human',
	name: 'Human',
	source: source('races/humans', 'Traits'),
	status: 'final',
	size: 'medium',
	speed: { walk: 30 },
	abilityBonuses: [
		{ kind: 'choice', amount: 1, count: 2, distinct: true },
		{ kind: 'choice', amount: 1, count: 1, distinct: false, atLevel: 10 }
	],
	languages: [
		{ kind: 'known', name: 'Common' },
		{ kind: 'choice', of: ['Kystri', 'Veldtwin', 'Wendric'], count: 1 }
	],
	tags: ['human'],
	grants: [
		{ kind: 'skillProficiency', skill: 'choice' },
		{
			kind: 'toolProficiency',
			tools: ['one tool, gaming set, or musical instrument of your choice']
		}
	],
	traits: [
		noEffect('market-pidgin', 'Crossroads Upbringing', 'Market pidgin is not simulated.'),
		{
			id: 'determined',
			name: 'Determined',
			summary: 'Once per long rest, add PB to an ability check that does not already include it.',
			cost: 'none',
			spend: [{ resource: 'human-determined', amount: '1' }],
			effects: [],
			scriptId: 'determined'
		}
	],
	resources: [
		{
			id: 'human-determined',
			name: 'Determined',
			max: '1',
			recharge: [{ on: 'longRest', regain: 'pool-max' }]
		}
	]
};

const veldtwin = {
	id: 'veldtwin',
	name: 'Veldtwin',
	source: source('races/elves', 'Veldtwin'),
	abilityBonuses: [{ kind: 'fixed', ability: 'cha', amount: 1 }],
	languages: [{ kind: 'known', name: 'Veldtwin' }],
	speed: { walk: 35 },
	traits: [
		noEffect(
			'veldtwin-mask-of-the-wild',
			'Mask of the Wild',
			'Natural concealment is not a grid layer yet.'
		)
	]
};

const elf = {
	id: 'elf',
	name: 'Elf',
	source: source('races/elves', 'Traits'),
	status: 'final',
	size: 'medium',
	speed: { walk: 30 },
	abilityBonuses: [{ kind: 'fixed', ability: 'dex', amount: 2 }],
	languages: [
		{ kind: 'known', name: 'Common' },
		{ kind: 'known', name: 'Elvish' }
	],
	tags: ['elf'],
	senses: { darkvision: 60 },
	grants: [
		{ kind: 'saveAdvantage', against: 'charmed' },
		{ kind: 'magicSleepImmunity' },
		{
			kind: 'weaponProficiency',
			weapons: ['spear', 'shortsword', 'shortbow', 'longbow']
		}
	],
	traits: [
		noEffect('trance', 'Trance', 'Rest length is not simulated beyond short and long rests.')
	],
	lineages: [veldtwin]
};

describe('Race', () => {
	it('accepts a race without lineages and a race with nested lineages', () => {
		expect(messages(Race, human)).toBe('');
		expect(messages(Race, elf)).toBe('');
	});

	it('rejects bad ids, unknown keys and a lineage that drops a trait the race does not have', () => {
		expect(messages(Race, { ...human, id: 'Human' })).toContain('kebab-case');
		expect(messages(Race, { ...human, age: '90 years' })).not.toBe('');
		expect(
			messages(Race, {
				...elf,
				lineages: [{ ...veldtwin, dropTraits: ['storm-sense'] }]
			})
		).toContain('drops unknown trait');
	});

	it('rejects a lineage that drops a language the race does not know, and duplicate lineage ids', () => {
		expect(
			messages(Race, {
				...elf,
				lineages: [{ ...veldtwin, dropLanguages: ['Kystri'] }]
			})
		).toContain('drops unknown language');
		expect(
			messages(Race, { ...elf, lineages: [veldtwin, { ...veldtwin, name: 'Copy' }] })
		).toContain('Duplicate lineage id');
	});

	it('rejects an empty speed override and darkvisionHue without darkvision', () => {
		expect(messages(Race, { ...elf, lineages: [{ ...veldtwin, speed: {} }] })).toContain(
			'walk, climb or swim'
		);
		expect(messages(Race, { ...elf, senses: { darkvisionHue: 'blue-green' } })).toContain(
			'darkvisionHue needs darkvision'
		);
	});
});

describe('Grant', () => {
	it('accepts proficiencies, save advantage, resistance and always-on flags', () => {
		expect(messages(Grant, { kind: 'skillProficiency', skill: 'perception' })).toBe('');
		expect(
			messages(Grant, {
				kind: 'skillProficiency',
				skill: 'choice',
				of: ['arcana', 'history', 'investigation', 'insight']
			})
		).toBe('');
		expect(messages(Grant, { kind: 'skillAbility', skill: 'intimidation', ability: 'str' })).toBe(
			''
		);
		expect(messages(Grant, { kind: 'saveAdvantage', against: 'disease' })).toBe('');
		expect(messages(Grant, { kind: 'damageResistance', type: 'poison' })).toBe('');
		expect(messages(Grant, { kind: 'amphibious' })).toBe('');
		expect(messages(Grant, { kind: 'ignoreHeavyArmorSpeed' })).toBe('');
	});

	it('rejects of on a named skill and a tool pick larger than the list', () => {
		expect(
			messages(Grant, {
				kind: 'skillProficiency',
				skill: 'athletics',
				of: ['athletics', 'acrobatics']
			})
		).toContain('of is only valid');
		expect(
			messages(Grant, {
				kind: 'toolProficiency',
				tools: ["smith's tools"],
				pick: 2
			})
		).toContain('pick cannot exceed');
	});
});
