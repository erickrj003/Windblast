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
		expect(checkContent([])).toEqual({ problems: [], counts: [], scripts: [] });
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

	const srdRecord = (fields: object): string =>
		JSON.stringify({
			source: { kind: 'srd51', page: 'conditions', section: 'Any' },
			status: 'final',
			...fields
		});
	const condition = (id: string, implies?: ReadonlyArray<string>): string =>
		srdRecord({ id, name: id, rules: ['Some rule.'], ...(implies ? { implies } : {}) });
	const damageType = (id: string): string => srdRecord({ id, name: id, description: 'Hurts.' });
	const zombie = srdRecord({
		id: 'zombie',
		name: 'Zombie',
		size: 'medium',
		type: 'undead',
		alignment: 'neutral evil',
		armorClass: { value: 8 },
		hitPoints: { average: 22, dice: '3d8 + 9' },
		speed: { walk: 20 },
		abilityScores: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
		damageImmunities: [{ type: 'poison' }],
		conditionImmunities: ['poisoned'],
		senses: { darkvision: 60, passivePerception: 8 },
		languages: [],
		challenge: '1/4',
		xp: 50,
		traits: [
			{
				id: 'undead-fortitude',
				name: 'Undead Fortitude',
				summary: 'A Constitution save can leave it at 1 hit point instead of 0.',
				cost: 'none',
				effects: [],
				scriptId: 'undead-fortitude'
			}
		],
		actions: [
			{
				kind: 'attack',
				id: 'slam',
				name: 'Slam',
				attack: 'meleeWeapon',
				toHit: 3,
				reach: 5,
				targets: 1,
				damage: [{ dice: '1d6 + 1', type: 'bludgeoning' }]
			}
		]
	});

	it('reports references to damage types and conditions that have no record', () => {
		const { problems } = checkContent([
			file('srd/conditions/paralyzed.json', condition('paralyzed', ['incapacitated'])),
			file('srd/monsters/zombie.json', zombie)
		]);
		expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
			'srd/conditions/paralyzed.json: implies.0: no conditions record "incapacitated"',
			'srd/monsters/zombie.json: actions.0.damage.0.type: no damage-types record "bludgeoning"',
			'srd/monsters/zombie.json: conditionImmunities.0: no conditions record "poisoned"',
			'srd/monsters/zombie.json: damageImmunities.0.type: no damage-types record "poison"'
		]);
	});

	it('passes once every referenced record exists, and lists script ids by record', () => {
		const report = checkContent([
			file('srd/conditions/incapacitated.json', condition('incapacitated')),
			file('srd/conditions/paralyzed.json', condition('paralyzed', ['incapacitated'])),
			file('srd/conditions/poisoned.json', condition('poisoned')),
			file('srd/damage-types/bludgeoning.json', damageType('bludgeoning')),
			file('srd/damage-types/poison.json', damageType('poison')),
			file('srd/monsters/zombie.json', zombie)
		]);
		expect(report.problems).toEqual([]);
		expect(report.scripts).toEqual([
			{ path: 'srd/monsters/zombie.json', at: 'traits.0', scriptId: 'undead-fortitude' }
		]);
	});

	it('reports missing damage types and conditions on weapons and features', () => {
		const weapon = srdRecord({
			id: 'club',
			name: 'Club',
			category: 'simple',
			type: 'melee',
			damage: { dice: '1d4', type: 'bludgeoning' },
			properties: ['light']
		});
		const feature = srdRecord({
			id: 'second-wind',
			name: 'Second Wind',
			summary: 'Heal a little.',
			cost: 'bonusAction',
			condition: { kind: 'hasCondition', who: 'self', condition: 'poisoned' },
			effects: [
				{ kind: 'heal', amount: '1d10', target: 'self' },
				{ kind: 'removeCondition', condition: 'frightened', target: 'self' },
				{
					kind: 'conditional',
					when: { kind: 'hpBelowHalf', who: 'self' },
					then: [{ kind: 'damage', amount: '1', damageType: 'fire', target: 'target' }]
				}
			]
		});
		const { problems } = checkContent([
			file('srd/weapons/club.json', weapon),
			file('srd/features/second-wind.json', feature)
		]);
		expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
			'srd/features/second-wind.json: condition.condition: no conditions record "poisoned"',
			'srd/features/second-wind.json: effects.1.condition: no conditions record "frightened"',
			'srd/features/second-wind.json: effects.2.then.0.damageType: no damage-types record "fire"',
			'srd/weapons/club.json: damage.type: no damage-types record "bludgeoning"'
		]);
	});

	it('reports missing weapons, damage types and conditions on a race', () => {
		const race = JSON.stringify({
			id: 'elf',
			name: 'Elf',
			source: {
				kind: 'inazria',
				page: 'races/elves',
				section: 'Traits',
				commit: '0'.repeat(40),
				contentHash: '0'.repeat(64)
			},
			status: 'final',
			size: 'medium',
			speed: { walk: 30 },
			abilityBonuses: [{ kind: 'fixed', ability: 'dex', amount: 2 }],
			languages: [{ kind: 'known', name: 'Common' }],
			tags: ['elf'],
			grants: [
				{ kind: 'weaponProficiency', weapons: ['spear'] },
				{ kind: 'saveAdvantage', against: 'charmed' },
				{ kind: 'damageResistance', type: 'poison' },
				{ kind: 'saveAdvantage', against: 'disease' }
			],
			traits: [
				{
					id: 'sundering-cry',
					name: 'Sundering Cry',
					summary: 'Thunder blast.',
					cost: 'action',
					effects: [
						{
							kind: 'save',
							ability: 'con',
							dc: '8 + pb + mod(cha)',
							target: { kind: 'creatures', side: 'any', within: 15, of: 'self', count: 'all' },
							onFail: [
								{
									kind: 'damage',
									amount: '1d8 + mod(cha)',
									damageType: 'thunder',
									target: 'target'
								},
								{
									kind: 'applyCondition',
									condition: 'deafened',
									target: 'target',
									duration: { kind: 'untilTurn', edge: 'end', whose: 'self', which: 'next' }
								}
							],
							halfOnSuccess: true
						}
					]
				}
			]
		});
		const { problems } = checkContent([file('inazria/races/elf.json', race)]);
		expect(problems.map((problem) => `${problem.path}: ${problem.message}`)).toEqual([
			'inazria/races/elf.json: grants.0.weapons.0: no weapons record "spear"',
			'inazria/races/elf.json: grants.1.against: no conditions record "charmed"',
			'inazria/races/elf.json: grants.2.type: no damage-types record "poison"',
			'inazria/races/elf.json: traits.0.effects.0.onFail.0.damageType: no damage-types record "thunder"',
			'inazria/races/elf.json: traits.0.effects.0.onFail.1.condition: no conditions record "deafened"'
		]);
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
