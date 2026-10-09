import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Creature, Effect, Feature, Predicate, ResourcePool, Source } from './index.ts';

const COMMIT = '23a5f30fff291f77e01939feea769ecedad57446';
const HASH = 'a'.repeat(64);

const inazriaSource = {
	kind: 'inazria',
	page: 'classes/civil/fighter',
	section: 'Core Class Features',
	commit: COMMIT,
	contentHash: HASH
} as const;

const without = (object: object, key: string): Record<string, unknown> =>
	Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

function messages(schema: v.GenericSchema<unknown, unknown>, input: unknown): string {
	const result = v.safeParse(schema, input);
	return result.success ? '' : result.issues.map((issue) => issue.message).join(' | ');
}

const secondWind = {
	id: 'second-wind',
	name: 'Second Wind',
	source: inazriaSource,
	status: 'final',
	summary: 'Spend 1 Exertion as a bonus action to regain 1d10 + fighter level hit points.',
	cost: 'bonusAction',
	spend: [{ resource: 'exertion', amount: '1' }],
	effects: [{ kind: 'heal', amount: '1d10 + level(fighter)', target: 'self' }]
};

const exertion = {
	id: 'exertion',
	name: 'Exertion',
	source: inazriaSource,
	status: 'final',
	max: 'pb',
	recharge: [
		{ on: 'shortRest', regain: 'pool-max' },
		{ on: 'longRest', regain: 'pool-max' }
	]
};

const goblin = {
	id: 'goblin',
	name: 'Goblin',
	source: { kind: 'srd51', page: 'monsters/goblin', section: 'Goblin' },
	status: 'final',
	size: 'small',
	type: 'humanoid',
	tags: ['goblinoid'],
	alignment: 'neutral evil',
	armorClass: { value: 15, note: 'leather armor, shield' },
	hitPoints: { average: 7, dice: '2d6' },
	speed: { walk: 30 },
	abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
	skills: { stealth: 6 },
	senses: { darkvision: 60, passivePerception: 9 },
	languages: ['Common', 'Goblin'],
	challenge: '1/4',
	xp: 50,
	traits: [
		{
			id: 'nimble-escape',
			name: 'Nimble Escape',
			summary: 'Disengage or Hide as a bonus action on each of its turns.',
			cost: 'bonusAction',
			effects: [],
			scriptId: 'nimble-escape'
		}
	],
	actions: [
		{
			kind: 'attack',
			id: 'scimitar',
			name: 'Scimitar',
			attack: 'meleeWeapon',
			toHit: 4,
			reach: 5,
			targets: 1,
			damage: [{ dice: '1d6 + 2', type: 'slashing' }]
		},
		{
			kind: 'attack',
			id: 'shortbow',
			name: 'Shortbow',
			attack: 'rangedWeapon',
			toHit: 4,
			range: { normal: 80, long: 320 },
			targets: 1,
			damage: [{ dice: '1d6 + 2', type: 'piercing' }]
		}
	]
};

describe('Source', () => {
	it('accepts a pinned Inazria source and a plain SRD source', () => {
		expect(messages(Source, inazriaSource)).toBe('');
		expect(
			messages(Source, { kind: 'srd51', page: 'combat', section: 'Opportunity Attacks' })
		).toBe('');
	});

	it('requires commit and contentHash on Inazria sources', () => {
		expect(messages(Source, without(inazriaSource, 'contentHash'))).toContain('contentHash');
		expect(messages(Source, without(inazriaSource, 'commit'))).toContain('commit');
		expect(messages(Source, { ...inazriaSource, commit: 'abc123' })).toContain('40-character');
		expect(messages(Source, { ...inazriaSource, contentHash: 'XYZ' })).toContain('SHA-256');
	});

	it('rejects pins on SRD sources, unknown kinds and malformed pages', () => {
		expect(
			messages(Source, { kind: 'srd51', page: 'combat', section: 'Cover', commit: COMMIT })
		).not.toBe('');
		expect(messages(Source, { kind: 'phb', page: 'combat', section: 'Cover' })).not.toBe('');
		expect(messages(Source, { ...inazriaSource, page: 'Classes/Fighter' })).toContain(
			'kebab-case paths'
		);
		expect(messages(Source, { ...inazriaSource, section: '  ' })).toContain('names the section');
	});
});

describe('Feature', () => {
	it('accepts a feature with costs, a resource spend and formula amounts', () => {
		expect(messages(Feature, secondWind)).toBe('');
	});

	it('rejects bad ids, unknown keys and missing status', () => {
		expect(messages(Feature, { ...secondWind, id: 'Second_Wind' })).toContain('kebab-case');
		expect(messages(Feature, { ...secondWind, uses: 3 })).not.toBe('');
		expect(messages(Feature, without(secondWind, 'status'))).not.toBe('');
		expect(messages(Feature, { ...secondWind, status: 'approved' })).not.toBe('');
	});

	it('rejects malformed formulas with the parser message', () => {
		const broken = { ...secondWind, effects: [{ kind: 'heal', amount: '1d10 +', target: 'self' }] };
		expect(messages(Feature, broken)).toContain('Invalid formula "1d10 +"');
	});

	it('needs effects or a scriptId, and a trigger for reactions', () => {
		expect(messages(Feature, { ...secondWind, effects: [] })).toContain('scriptId');
		expect(messages(Feature, { ...secondWind, effects: [], scriptId: 'second-wind' })).toBe('');
		expect(messages(Feature, { ...secondWind, cost: 'reaction' })).toContain('needs a trigger');
		expect(
			messages(Feature, { ...secondWind, cost: 'reaction', trigger: { on: 'hit', as: 'target' } })
		).toBe('');
	});
});

describe('Effect and Predicate', () => {
	it('nests the effects of a saving throw', () => {
		const push = {
			kind: 'save',
			ability: 'str',
			dc: '8 + pb + max(mod(str), mod(dex))',
			target: 'target',
			onFail: [
				{ kind: 'move', who: 'target', feet: '15', direction: 'away', provokes: false },
				{
					kind: 'applyCondition',
					condition: 'prone',
					target: 'target',
					duration: { kind: 'instant' }
				}
			]
		};
		expect(messages(Effect, push)).toBe('');
		expect(messages(Effect, { ...push, onFail: [] })).not.toBe('');
		expect(messages(Effect, { ...push, ability: 'strength' })).not.toBe('');
	});

	it('requires an amount exactly when modifyRoll adds a bonus', () => {
		const bonus = {
			kind: 'modifyRoll',
			roll: 'attack',
			mode: 'bonus',
			amount: 'pb',
			target: 'self'
		};
		expect(messages(Effect, bonus)).toBe('');
		expect(messages(Effect, without(bonus, 'amount'))).toContain('amount exactly when');
		expect(messages(Effect, { ...bonus, mode: 'advantage' })).toContain('amount exactly when');
	});

	it('accepts every other effect kind', () => {
		const effects = [
			{ kind: 'attack', with: 'weapon', range: 'melee', target: 'target' },
			{
				kind: 'damage',
				amount: 'pb',
				damageType: 'weapon',
				target: 'target',
				budget: 'mastery-damage'
			},
			{ kind: 'heal', amount: 'pb + mod(con)', target: 'self', temporary: true },
			{ kind: 'removeCondition', condition: 'frightened', target: 'self' },
			{ kind: 'spendResource', resource: 'guile', amount: '1' },
			{ kind: 'gainResource', resource: 'exertion', amount: '1' },
			{ kind: 'grantAction', action: 'action', count: 1 },
			{
				kind: 'applyCondition',
				condition: 'marked',
				target: { kind: 'creatures', side: 'enemy', within: 5, of: 'self', count: 2 },
				duration: { kind: 'untilTurn', edge: 'start', whose: 'self', which: 'next' }
			},
			{
				kind: 'modifyRoll',
				roll: 'savingThrow',
				mode: 'advantage',
				target: {
					kind: 'creatures',
					side: 'ally',
					within: 10,
					of: 'self',
					count: 'all',
					includeSelf: true
				},
				duration: { kind: 'rounds', count: 10 }
			}
		];
		for (const effect of effects) expect(messages(Effect, effect), JSON.stringify(effect)).toBe('');
		expect(messages(Effect, { kind: 'teleport', target: 'self' })).not.toBe('');
	});

	it('combines predicates with all, any and not', () => {
		const trainedForBattle = {
			kind: 'all',
			of: [
				{ kind: 'wearingArmor', who: 'self', category: 'heavy' },
				{ kind: 'attack', range: 'melee', with: 'weapon' },
				{
					kind: 'any',
					of: [
						{ kind: 'weaponProperty', property: 'two-handed' },
						{ kind: 'weaponProperty', property: 'versatile' }
					]
				},
				{
					kind: 'not',
					predicate: { kind: 'hasCondition', who: 'self', condition: 'incapacitated' }
				}
			]
		};
		expect(messages(Predicate, trainedForBattle)).toBe('');
		expect(
			messages(Predicate, {
				kind: 'any',
				of: [
					{ kind: 'rollMode', mode: 'advantage' },
					{ kind: 'creatureNear', of: 'target', within: 5, side: 'enemy', excluding: 'self' }
				]
			})
		).toBe('');
		expect(messages(Predicate, { kind: 'hpBelowHalf', who: 'target' })).toBe('');
		expect(
			messages(Predicate, { kind: 'all', of: [{ kind: 'hpBelowHalf', who: 'self' }] })
		).not.toBe('');
		expect(messages(Predicate, { kind: 'weaponProperty', property: 'sharp' })).not.toBe('');
	});
});

describe('ResourcePool', () => {
	it('accepts a pool with a formula maximum and rest recharges', () => {
		expect(messages(ResourcePool, exertion)).toBe('');
		const devotion = {
			...exertion,
			id: 'devotion',
			name: 'Devotion',
			max: 'max(1, pb + mod(cha))',
			recharge: [
				{ on: 'longRest', regain: 'pool-max' },
				{ on: 'shortRest', regain: 'ceil(pool-max / 2)' }
			]
		};
		expect(messages(ResourcePool, devotion)).toBe('');
	});

	it('rejects unknown recharge moments and bad maxima', () => {
		expect(
			messages(ResourcePool, { ...exertion, recharge: [{ on: 'dawn', regain: '1' }] })
		).not.toBe('');
		expect(messages(ResourcePool, { ...exertion, max: 'proficiency' })).toContain('unknown name');
	});
});

describe('Creature', () => {
	it('accepts an SRD stat block', () => {
		expect(messages(Creature, goblin)).toBe('');
	});

	it('rejects malformed or creature-dependent dice', () => {
		const withDamage = (dice: string): unknown => ({
			...goblin,
			actions: [{ ...goblin.actions[0], damage: [{ dice, type: 'slashing' }] }]
		});
		expect(messages(Creature, withDamage('1d6 +'))).toContain('Invalid formula');
		expect(messages(Creature, withDamage('1d6 + mod(str)'))).toContain('Stat block dice');
		expect(messages(Creature, { ...goblin, hitPoints: { average: 7, dice: '2d' } })).not.toBe('');
	});

	it('rejects out-of-range scores, unknown skills and bad challenge ratings', () => {
		const scores = { ...goblin.abilityScores, str: 31 };
		expect(messages(Creature, { ...goblin, abilityScores: scores })).not.toBe('');
		expect(messages(Creature, { ...goblin, skills: { sneaking: 6 } })).not.toBe('');
		expect(messages(Creature, { ...goblin, challenge: '1/3' })).not.toBe('');
	});

	it('checks multiattack references and duplicate ids', () => {
		const multiattack = {
			kind: 'multiattack',
			id: 'multiattack',
			name: 'Multiattack',
			options: [[{ action: 'scimitar', count: 2 }], [{ action: 'shortbow', count: 2 }]]
		};
		expect(messages(Creature, { ...goblin, actions: [...goblin.actions, multiattack] })).toBe('');
		const unknown = { ...multiattack, options: [[{ action: 'bite', count: 1 }]] };
		expect(messages(Creature, { ...goblin, actions: [...goblin.actions, unknown] })).toContain(
			'unknown attack "bite"'
		);
		const duplicate = { ...goblin.actions[0], name: 'Second Scimitar' };
		expect(messages(Creature, { ...goblin, actions: [...goblin.actions, duplicate] })).toContain(
			'Duplicate trait or action id "scimitar"'
		);
	});

	it('validates non-attack actions with the feature rules', () => {
		const breath = {
			kind: 'feature',
			id: 'fire-breath',
			name: 'Fire Breath',
			summary: 'Each creature in a 15-foot cone makes a Dexterity save.',
			cost: 'action',
			effects: []
		};
		expect(messages(Creature, { ...goblin, actions: [...goblin.actions, breath] })).toContain(
			'scriptId'
		);
		const scripted = { ...breath, scriptId: 'fire-breath' };
		expect(messages(Creature, { ...goblin, actions: [...goblin.actions, scripted] })).toBe('');
	});
});
