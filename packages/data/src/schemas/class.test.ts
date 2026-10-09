import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { Class } from './index.ts';

const source = {
	kind: 'inazria' as const,
	page: 'classes/civil/fighter',
	section: 'Fighter',
	commit: '23a5f30fff291f77e01939feea769ecedad57446',
	contentHash: 'a'.repeat(64)
};

function messages(input: unknown): string {
	const result = v.safeParse(Class, input);
	return result.success ? '' : result.issues.map((issue) => issue.message).join(' | ');
}

const fighter = {
	id: 'fighter',
	name: 'Fighter',
	source,
	status: 'final',
	archetype: 'civil',
	tags: ['fighter'],
	encodedLevels: { from: 1, through: 5 },
	hitDie: 10,
	hitPoints: { atFirst: '10 + mod(con)', perLevel: '1d10 + mod(con)', average: '6 + mod(con)' },
	proficiencies: {
		armor: ['light', 'medium', 'heavy', 'shield'],
		weapons: 'simple-and-martial',
		tools: [],
		savingThrows: ['str', 'con'],
		skills: { count: 2, of: ['athletics', 'perception'] }
	},
	startingEquipment: [
		{
			choose: 1,
			options: [
				{ id: 'chain-mail', label: 'chain mail', items: [{ kind: 'armor', id: 'chain-mail' }] },
				{
					id: 'leather-and-longbow',
					label: 'leather armor, longbow, and 20 arrows',
					items: [
						{ kind: 'armor', id: 'leather' },
						{ kind: 'weapon', id: 'longbow' },
						{ kind: 'note', text: '20 arrows' }
					]
				}
			]
		}
	],
	classRules: {
		concentration: 'asSpell',
		oncePerTurnUnlessStated: true,
		limitedUses: { max: 'pb', recharge: 'longRest' },
		masteryBudget: 'mastery-damage',
		notSimulated: ['Multiclassing is deferred until after v1.']
	},
	resources: [
		{
			id: 'exertion',
			name: 'Exertion',
			max: 'pb',
			recharge: [
				{ on: 'shortRest', regain: 'pool-max' },
				{ on: 'longRest', regain: 'pool-max' }
			]
		}
	],
	techniqueTraining: {
		pointsAtFirst: 2,
		pointsPerLevelAfterFirst: 1,
		ranks: [
			{ rank: 'untrained', points: 0 },
			{ rank: 'familiar', points: 1 },
			{ rank: 'practiced', points: 3 },
			{ rank: 'mastered', points: 6 }
		],
		improvisedSpend: { resource: 'exertion', amount: '1' },
		oncePerTurn: true,
		saveDc: {
			base: '8 + pb',
			ability: { kind: 'choice', of: ['str', 'dex'], when: 'gainTechnique' }
		}
	},
	fightingStyles: {
		source: { ...source, section: 'Fighting Styles' },
		choose: 1,
		replaceOn: 'longRest',
		anotherAtLevel: 10,
		options: [
			{
				id: 'defense',
				name: 'Defense',
				summary: '+1 AC while wearing armor.',
				cost: 'none',
				condition: {
					kind: 'any',
					of: [
						{ kind: 'wearingArmor', who: 'self', category: 'light' },
						{ kind: 'wearingArmor', who: 'self', category: 'medium' },
						{ kind: 'wearingArmor', who: 'self', category: 'heavy' }
					]
				},
				effects: [{ kind: 'modifyArmorClass', amount: '1', target: 'self' }]
			},
			{
				id: 'archery',
				name: 'Archery',
				summary: '+2 to attack rolls with ranged weapons.',
				cost: 'none',
				effects: [],
				scriptId: 'archery'
			}
		]
	},
	features: [
		{
			id: 'second-wind',
			name: 'Second Wind',
			summary: 'Spend 1 Exertion as a bonus action to regain 1d10 + fighter level hit points.',
			level: 1,
			cost: 'bonusAction',
			spend: [{ resource: 'exertion', amount: '1' }],
			effects: [{ kind: 'heal', amount: '1d10 + level(fighter)', target: 'self' }]
		},
		{
			id: 'ability-score-improvement',
			name: 'Ability Score Improvement',
			summary: 'Increase one ability score by 2, or two by 1, at the listed levels.',
			level: 4,
			alsoAtLevels: [8, 12, 16, 19],
			cost: 'none',
			effects: [],
			noEffect: 'Ability score choices are character build, not a combat action.'
		}
	]
};

describe('Class', () => {
	it('accepts a fighter base through level 5', () => {
		expect(messages(fighter)).toBe('');
	});

	it('rejects a feature outside the encoded levels and a spend of an unknown pool', () => {
		expect(messages({ ...fighter, features: [{ ...fighter.features[0], level: 11 }] })).toContain(
			'outside encoded levels'
		);
		expect(
			messages({
				...fighter,
				features: [
					{
						...fighter.features[0],
						spend: [{ resource: 'devotion', amount: '1' }]
					}
				]
			})
		).toContain('unknown resource');
	});

	it('rejects too many skill choices and a reversed level range', () => {
		expect(
			messages({
				...fighter,
				proficiencies: {
					...fighter.proficiencies,
					skills: { count: 3, of: ['athletics'] }
				}
			})
		).toContain('Skill choices');
		expect(messages({ ...fighter, encodedLevels: { from: 5, through: 1 } })).toContain(
			'cannot be greater'
		);
	});
});
