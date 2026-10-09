import * as v from 'valibot';
import { CHALLENGE_RATINGS, CREATURE_TYPES, SIZES } from '../vocabulary.ts';
import { Ability, DiceText, Feet, Id, Skill, recordFields } from './common.ts';
import { Effect } from './effect.ts';
import { InlineFeature, featureFields, featureProblem } from './feature.ts';

const Int = v.pipe(v.number(), v.integer());
const AbilityScore = v.pipe(Int, v.minValue(1), v.maxValue(30));

/** A resistance, immunity or vulnerability, such as "slashing from nonmagical attacks". */
const DamageRule = v.strictObject({
	type: Id,
	unless: v.exactOptional(v.picklist(['magical', 'silvered', 'adamantine']))
});

const MonsterAttack = v.strictObject({
	kind: v.literal('attack'),
	id: Id,
	name: v.pipe(v.string(), v.nonEmpty()),
	attack: v.picklist(['meleeWeapon', 'rangedWeapon', 'meleeSpell', 'rangedSpell']),
	toHit: Int,
	reach: v.exactOptional(Feet),
	range: v.exactOptional(v.strictObject({ normal: Feet, long: v.exactOptional(Feet) })),
	targets: v.pipe(Int, v.minValue(1)),
	damage: v.pipe(v.array(v.strictObject({ dice: DiceText, type: Id })), v.minLength(1)),
	onHit: v.exactOptional(v.array(Effect))
});

const Multiattack = v.strictObject({
	kind: v.literal('multiattack'),
	id: Id,
	name: v.pipe(v.string(), v.nonEmpty()),
	options: v.pipe(
		v.array(
			v.pipe(
				v.array(v.strictObject({ action: Id, count: v.pipe(Int, v.minValue(1)) })),
				v.minLength(1)
			)
		),
		v.minLength(1)
	)
});

const MonsterAction = v.pipe(
	v.variant('kind', [
		MonsterAttack,
		Multiattack,
		v.strictObject({ kind: v.literal('feature'), ...featureFields })
	]),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed || dataset.value.kind !== 'feature') return;
		const problem = featureProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	})
);

/**
 * An SRD-style stat block. Damage dice must be self-contained (`2d6 + 3`); traits and
 * non-attack actions use the feature vocabulary.
 * @rule srd51:monsters#statistics
 */
export const Creature = v.pipe(
	v.strictObject({
		...recordFields,
		size: v.picklist(SIZES),
		type: v.picklist(CREATURE_TYPES),
		tags: v.exactOptional(v.array(Id)),
		alignment: v.pipe(v.string(), v.nonEmpty()),
		armorClass: v.strictObject({
			value: v.pipe(Int, v.minValue(0), v.maxValue(30)),
			note: v.exactOptional(v.pipe(v.string(), v.nonEmpty()))
		}),
		hitPoints: v.strictObject({ average: v.pipe(Int, v.minValue(1)), dice: DiceText }),
		speed: v.strictObject({
			walk: Feet,
			burrow: v.exactOptional(Feet),
			climb: v.exactOptional(Feet),
			fly: v.exactOptional(Feet),
			swim: v.exactOptional(Feet),
			hover: v.exactOptional(v.boolean())
		}),
		abilityScores: v.strictObject({
			str: AbilityScore,
			dex: AbilityScore,
			con: AbilityScore,
			int: AbilityScore,
			wis: AbilityScore,
			cha: AbilityScore
		}),
		savingThrows: v.exactOptional(v.record(Ability, Int)),
		skills: v.exactOptional(v.record(Skill, Int)),
		damageVulnerabilities: v.exactOptional(v.array(DamageRule)),
		damageResistances: v.exactOptional(v.array(DamageRule)),
		damageImmunities: v.exactOptional(v.array(DamageRule)),
		conditionImmunities: v.exactOptional(v.array(Id)),
		senses: v.strictObject({
			blindsight: v.exactOptional(Feet),
			darkvision: v.exactOptional(Feet),
			tremorsense: v.exactOptional(Feet),
			truesight: v.exactOptional(Feet),
			passivePerception: Int
		}),
		languages: v.array(v.pipe(v.string(), v.nonEmpty())),
		challenge: v.picklist(CHALLENGE_RATINGS),
		xp: v.pipe(Int, v.minValue(0)),
		traits: v.exactOptional(v.array(InlineFeature)),
		actions: v.pipe(v.array(MonsterAction), v.minLength(1)),
		reactions: v.exactOptional(v.array(InlineFeature))
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const creature = dataset.value;
		const ids = [
			...(creature.traits ?? []).map((trait) => trait.id),
			...creature.actions.map((action) => action.id),
			...(creature.reactions ?? []).map((reaction) => reaction.id)
		];
		const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
		if (duplicate !== undefined)
			addIssue({ message: `Duplicate trait or action id "${duplicate}"` });

		const attackIds = new Set(
			creature.actions.filter((action) => action.kind === 'attack').map((action) => action.id)
		);
		for (const action of creature.actions) {
			if (action.kind !== 'multiattack') continue;
			for (const step of action.options.flat()) {
				if (!attackIds.has(step.action)) {
					addIssue({ message: `Multiattack "${action.id}" uses unknown attack "${step.action}"` });
				}
			}
		}
	})
);
export type Creature = v.InferOutput<typeof Creature>;
