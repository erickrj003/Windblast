import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Creature, InlineFeature, Predicate } from './index.ts';

function messages(schema: v.GenericSchema<unknown, unknown>, input: unknown): string {
	const result = v.safeParse(schema, input);
	return result.success ? '' : result.issues.map((issue) => issue.message).join(' | ');
}

const without = (object: object, ...keys: ReadonlyArray<string>): Record<string, unknown> =>
	Object.fromEntries(Object.entries(object).filter(([name]) => !keys.includes(name)));

const melee = (id: string, toHit: number, dice: string, type: string) => ({
	kind: 'attack',
	id,
	name: id,
	attack: 'meleeWeapon',
	toHit,
	reach: 5,
	targets: 1,
	damage: [{ dice, type }]
});

const base = {
	id: 'test-beast',
	name: 'Test Beast',
	source: { kind: 'srd51', page: 'monsters', section: 'Test Beast' },
	status: 'final',
	size: 'medium',
	type: 'beast',
	alignment: 'unaligned',
	armorClass: { value: 13, note: 'natural armor' },
	hitPoints: { average: 11, dice: '2d8 + 2' },
	speed: { walk: 40 },
	abilityScores: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
	senses: { passivePerception: 13 },
	languages: [],
	challenge: '1/4',
	xp: 50
};

const creature = (...actions: ReadonlyArray<object>) => ({ ...base, actions });

const wolfBite = {
	...melee('bite', 4, '2d4 + 2', 'piercing'),
	onHit: [
		{
			kind: 'save',
			ability: 'str',
			dc: '11',
			target: 'target',
			onFail: [
				{
					kind: 'applyCondition',
					condition: 'prone',
					target: 'target',
					duration: { kind: 'untilRemoved' }
				}
			]
		}
	]
};

const ghoulClaws = {
	...melee('claws', 4, '2d4 + 2', 'slashing'),
	onHit: [
		{
			kind: 'conditional',
			when: {
				kind: 'not',
				predicate: {
					kind: 'any',
					of: [
						{ kind: 'creatureType', who: 'target', type: 'undead' },
						{ kind: 'hasTag', who: 'target', tag: 'elf' }
					]
				}
			},
			then: [
				{
					kind: 'save',
					ability: 'con',
					dc: '10',
					target: 'target',
					onFail: [
						{
							kind: 'applyCondition',
							condition: 'paralyzed',
							target: 'target',
							duration: { kind: 'rounds', count: 10 },
							repeatSave: { ability: 'con', dc: '10', at: 'turnEnd' }
						}
					]
				}
			]
		}
	]
};

const spiderBite = {
	...melee('bite', 5, '1d8 + 3', 'piercing'),
	onHit: [
		{
			kind: 'save',
			ability: 'con',
			dc: '11',
			target: 'target',
			halfOnSuccess: true,
			onFail: [{ kind: 'damage', amount: '2d8', damageType: 'poison', target: 'target' }]
		}
	],
	scriptId: 'giant-spider-venom'
};

const spiderWeb = {
	kind: 'attack',
	id: 'web',
	name: 'Web',
	attack: 'rangedWeapon',
	toHit: 5,
	range: { normal: 30, long: 60 },
	targets: 1,
	recharge: 5,
	damage: [],
	onHit: [
		{
			kind: 'applyCondition',
			condition: 'restrained',
			target: 'target',
			duration: { kind: 'untilRemoved' }
		}
	],
	scriptId: 'giant-spider-web'
};

const bugbearJavelin = {
	kind: 'attack',
	id: 'javelin',
	name: 'Javelin',
	attack: 'meleeOrRangedWeapon',
	toHit: 4,
	reach: 5,
	range: { normal: 30, long: 120 },
	targets: 1,
	damage: [{ dice: '2d6 + 2', type: 'piercing' }],
	atRange: [{ dice: '1d6 + 2', type: 'piercing' }]
};

const hobgoblinLongsword = {
	...melee('longsword', 3, '1d8 + 1', 'slashing'),
	versatile: [{ dice: '1d10 + 1', type: 'slashing' }]
};

describe('monster attacks [srd51:monsters]', () => {
	it('accepts save riders, conditional riders, recharge and scripted riders', () => {
		expect(messages(Creature, creature(wolfBite))).toBe('');
		expect(messages(Creature, creature(ghoulClaws))).toBe('');
		expect(messages(Creature, creature(spiderBite, spiderWeb))).toBe('');
	});

	it('accepts melee-or-ranged attacks and two-handed damage', () => {
		expect(messages(Creature, creature(bugbearJavelin, hobgoblinLongsword))).toBe('');
	});

	it('matches reach and range to how the attack is made', () => {
		expect(messages(Creature, creature(without(bugbearJavelin, 'range')))).toMatch(/range/);
		expect(messages(Creature, creature(without(bugbearJavelin, 'reach')))).toMatch(/reach/);
		expect(messages(Creature, creature({ ...wolfBite, range: { normal: 20, long: 60 } }))).toMatch(
			/range/
		);
		expect(messages(Creature, creature(without(spiderWeb, 'range')))).toMatch(/range/);
	});

	it('limits at-range damage to melee-or-ranged attacks and two-handed damage to melee', () => {
		expect(
			messages(Creature, creature({ ...wolfBite, atRange: [{ dice: '1d4', type: 'piercing' }] }))
		).toMatch(/at range/);
		expect(
			messages(Creature, creature({ ...spiderWeb, versatile: [{ dice: '1d4', type: 'piercing' }] }))
		).toMatch(/two hands/);
	});

	it('needs damage, a hit rider or a script on every attack', () => {
		expect(messages(Creature, creature(without(spiderWeb, 'onHit', 'scriptId')))).toMatch(/damage/);
	});

	it('lists every property that cancels a resistance [srd51:monsters/wight]', () => {
		expect(
			messages(Creature, {
				...creature(wolfBite),
				damageResistances: [{ type: 'slashing', unless: ['magical', 'silvered'] }]
			})
		).toBe('');
		expect(
			messages(Creature, {
				...creature(wolfBite),
				damageResistances: [{ type: 'slashing', unless: 'magical' }]
			})
		).not.toBe('');
	});

	it('accepts Recharge 2 to 6 only [srd51:monsters#recharge]', () => {
		expect(messages(Creature, creature({ ...spiderWeb, recharge: 6 }))).toBe('');
		expect(messages(Creature, creature({ ...spiderWeb, recharge: 1 }))).not.toBe('');
		expect(messages(Creature, creature({ ...spiderWeb, recharge: 7 }))).not.toBe('');
	});

	it('rejects a repeat save without a DC and an unknown duration', () => {
		const [rider] = ghoulClaws.onHit;
		const broken = JSON.parse(JSON.stringify(rider).replace('"dc":"10","at"', '"at"')) as object;
		expect(messages(Creature, creature({ ...ghoulClaws, onHit: [broken] }))).not.toBe('');
		const forever = JSON.stringify(wolfBite).replace('untilRemoved', 'forever');
		expect(messages(Creature, creature(JSON.parse(forever) as object))).not.toBe('');
	});
});

describe('traits', () => {
	const trait = {
		id: 'keen-hearing-and-smell',
		name: 'Keen Hearing and Smell',
		summary: 'Advantage on Wisdom (Perception) checks that rely on hearing or smell.',
		cost: 'none',
		effects: []
	};

	it('accepts a trait the simulator does not model when it says why', () => {
		expect(
			messages(InlineFeature, { ...trait, noEffect: 'Perception checks are not simulated.' })
		).toBe('');
		expect(messages(InlineFeature, trait)).toMatch(/noEffect/);
	});

	it('rejects a noEffect reason on a feature that has effects or a script', () => {
		const pack = {
			...trait,
			effects: [{ kind: 'modifyRoll', roll: 'attack', mode: 'advantage', target: 'self' }],
			noEffect: 'Not simulated.'
		};
		expect(messages(InlineFeature, pack)).toMatch(/noEffect/);
		expect(
			messages(InlineFeature, { ...trait, scriptId: 'keen-senses', noEffect: 'Not simulated.' })
		).toMatch(/noEffect/);
	});

	it('moves a creature up to its speed (Aggressive) [srd51:monsters/orc]', () => {
		expect(
			messages(InlineFeature, {
				id: 'aggressive',
				name: 'Aggressive',
				summary: 'As a bonus action, move up to its speed toward a hostile creature it can see.',
				cost: 'bonusAction',
				effects: [{ kind: 'move', who: 'self', feet: 'speed', direction: 'toward', provokes: true }]
			})
		).toBe('');
	});

	it('counts only able allies for Pack Tactics', () => {
		expect(
			messages(Predicate, {
				kind: 'creatureNear',
				of: 'target',
				within: 5,
				side: 'enemy',
				excluding: 'self',
				excludeIncapacitated: true
			})
		).toBe('');
		expect(
			messages(Predicate, { kind: 'creatureType', who: 'target', type: 'dragonkin' })
		).not.toBe('');
	});
});
