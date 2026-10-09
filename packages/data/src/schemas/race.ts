import * as v from 'valibot';
import { SIZES } from '../vocabulary.ts';
import { Ability, Feet, Id, Skill, Source, recordFields } from './common.ts';
import { InlineFeature, InlinePool } from './feature.ts';

const NonEmpty = v.pipe(v.string(), v.trim(), v.nonEmpty());
const BonusAmount = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2));

/**
 * A racial ability score increase: a fixed bonus, or a choice of scores (Humans pick two
 * different scores, then another +1 at 10th level).
 */
export const AbilityBonus = v.variant('kind', [
	v.strictObject({ kind: v.literal('fixed'), ability: Ability, amount: BonusAmount }),
	v.strictObject({
		kind: v.literal('choice'),
		amount: BonusAmount,
		count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(6)),
		distinct: v.boolean(),
		atLevel: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)))
	})
]);
export type AbilityBonus = v.InferOutput<typeof AbilityBonus>;

/**
 * Languages a race or lineage grants. Names stay as the guide writes them; there is no language
 * catalog yet.
 */
export const LanguageGrant = v.variant('kind', [
	v.strictObject({ kind: v.literal('known'), name: NonEmpty }),
	v.strictObject({
		kind: v.literal('choice'),
		of: v.pipe(v.array(NonEmpty), v.minLength(2)),
		count: v.pipe(v.number(), v.integer(), v.minValue(1))
	}),
	v.strictObject({
		kind: v.literal('any'),
		count: v.pipe(v.number(), v.integer(), v.minValue(1))
	})
]);
export type LanguageGrant = v.InferOutput<typeof LanguageGrant>;

const Speed = v.strictObject({
	walk: Feet,
	climb: v.exactOptional(Feet),
	swim: v.exactOptional(Feet)
});

const SpeedOverride = v.pipe(
	v.strictObject({
		walk: v.exactOptional(Feet),
		climb: v.exactOptional(Feet),
		swim: v.exactOptional(Feet)
	}),
	v.check(
		(speed) => speed.walk !== undefined || speed.climb !== undefined || speed.swim !== undefined,
		'A speed override must name walk, climb or swim'
	)
);

const Senses = v.pipe(
	v.strictObject({
		darkvision: v.exactOptional(Feet),
		darkvisionHue: v.exactOptional(v.picklist(['gray', 'blue-green']))
	}),
	v.check(
		(senses) => senses.darkvisionHue === undefined || senses.darkvision !== undefined,
		'darkvisionHue needs darkvision'
	)
);

/** Saving throws a grant can give advantage on. `disease` is not an SRD condition record. */
export const SAVE_AGAINST = [
	'charmed',
	'poisoned',
	'frightened',
	'blinded',
	'disease',
	'exhaustion'
] as const;
export type SaveAgainst = (typeof SAVE_AGAINST)[number];

const grantObject = v.variant('kind', [
	v.strictObject({
		kind: v.literal('skillProficiency'),
		skill: v.union([Skill, v.literal('choice')]),
		of: v.exactOptional(v.pipe(v.array(Skill), v.minLength(2)))
	}),
	v.strictObject({
		kind: v.literal('skillAbility'),
		skill: Skill,
		ability: Ability
	}),
	v.strictObject({
		kind: v.literal('weaponProficiency'),
		weapons: v.pipe(v.array(Id), v.minLength(1))
	}),
	v.strictObject({
		kind: v.literal('toolProficiency'),
		tools: v.pipe(v.array(NonEmpty), v.minLength(1)),
		pick: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1)))
	}),
	v.strictObject({
		kind: v.literal('saveAdvantage'),
		against: v.picklist(SAVE_AGAINST)
	}),
	v.strictObject({ kind: v.literal('damageResistance'), type: Id }),
	v.strictObject({ kind: v.literal('magicSleepImmunity') }),
	v.strictObject({ kind: v.literal('ignoreHeavyArmorSpeed') }),
	v.strictObject({ kind: v.literal('amphibious') })
]);

type GrantShape = v.InferOutput<typeof grantObject>;

/** Returns why a grant is inconsistent, or `undefined` when it is fine. */
export function grantProblem(grant: GrantShape): string | undefined {
	if (grant.kind === 'skillProficiency' && grant.skill !== 'choice' && grant.of !== undefined) {
		return 'of is only valid on a skill choice';
	}
	if (
		grant.kind === 'toolProficiency' &&
		grant.pick !== undefined &&
		grant.pick > grant.tools.length
	) {
		return 'pick cannot exceed the number of tools listed';
	}
	return undefined;
}

/**
 * A static character-build modifier: proficiency, resistance, save advantage, or a similar
 * always-on rule that is not a triggered feature.
 */
export const Grant = v.pipe(
	grantObject,
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const problem = grantProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	})
);
export type Grant = v.InferOutput<typeof Grant>;

const lineageObject = v.strictObject({
	id: Id,
	name: NonEmpty,
	source: Source,
	abilityBonuses: v.pipe(v.array(AbilityBonus), v.minLength(1)),
	languages: v.exactOptional(v.pipe(v.array(LanguageGrant), v.minLength(1))),
	speed: v.exactOptional(SpeedOverride),
	senses: v.exactOptional(Senses),
	dropTraits: v.exactOptional(v.pipe(v.array(Id), v.minLength(1))),
	dropLanguages: v.exactOptional(v.pipe(v.array(NonEmpty), v.minLength(1))),
	grants: v.exactOptional(v.pipe(v.array(Grant), v.minLength(1))),
	traits: v.exactOptional(v.pipe(v.array(InlineFeature), v.minLength(1))),
	resources: v.exactOptional(v.pipe(v.array(InlinePool), v.minLength(1)))
});

/** A player lineage nested on a race record (Veldtwin, Guphati, Dramkhani, …). */
export const Lineage = lineageObject;
export type Lineage = v.InferOutput<typeof Lineage>;

interface RaceShape {
	readonly traits?: ReadonlyArray<{ readonly id: string }>;
	readonly resources?: ReadonlyArray<{ readonly id: string }>;
	readonly languages: ReadonlyArray<LanguageGrant>;
	readonly lineages?: ReadonlyArray<{
		readonly id: string;
		readonly dropTraits?: ReadonlyArray<string>;
		readonly dropLanguages?: ReadonlyArray<string>;
		readonly traits?: ReadonlyArray<{ readonly id: string }>;
		readonly resources?: ReadonlyArray<{ readonly id: string }>;
	}>;
}

function duplicateId(
	ids: ReadonlyArray<string>
): { readonly id: string; readonly index: number } | undefined {
	const index = ids.findIndex((id, at) => ids.indexOf(id) !== at);
	if (index < 0) return undefined;
	const id = ids[index];
	return id === undefined ? undefined : { id, index };
}

/** Returns why a race record is inconsistent, or `undefined` when it is fine. */
export function raceProblem(race: RaceShape): string | undefined {
	const traitIds = (race.traits ?? []).map((trait) => trait.id);
	const resourceIds = (race.resources ?? []).map((pool) => pool.id);
	const knownLanguages = race.languages
		.filter((grant) => grant.kind === 'known')
		.map((grant) => grant.name);

	const parentDup = duplicateId([...traitIds, ...resourceIds]);
	if (parentDup !== undefined) return `Duplicate trait or resource id "${parentDup.id}"`;

	const lineages = race.lineages ?? [];
	const lineageIds = lineages.map((lineage) => lineage.id);
	const lineageDup = duplicateId(lineageIds);
	if (lineageDup !== undefined) return `Duplicate lineage id "${lineageDup.id}"`;

	for (const lineage of lineages) {
		for (const id of lineage.dropTraits ?? []) {
			if (!traitIds.includes(id)) return `Lineage "${lineage.id}" drops unknown trait "${id}"`;
		}
		for (const name of lineage.dropLanguages ?? []) {
			if (!knownLanguages.includes(name)) {
				return `Lineage "${lineage.id}" drops unknown language "${name}"`;
			}
		}
		const localDup = duplicateId([
			...(lineage.traits ?? []).map((trait) => trait.id),
			...(lineage.resources ?? []).map((pool) => pool.id)
		]);
		if (localDup !== undefined) {
			return `Lineage "${lineage.id}" has duplicate trait or resource id "${localDup.id}"`;
		}
	}
	return undefined;
}

/**
 * An Inazria player race. Lineages nest here so one guide page stays one file. Humans and
 * Hyzalians have no player lineages; Te-Hyzalians are not a player option and are omitted.
 */
export const Race = v.pipe(
	v.strictObject({
		...recordFields,
		size: v.picklist(SIZES),
		speed: Speed,
		abilityBonuses: v.pipe(v.array(AbilityBonus), v.minLength(1)),
		languages: v.pipe(v.array(LanguageGrant), v.minLength(1)),
		tags: v.pipe(v.array(Id), v.minLength(1)),
		senses: v.exactOptional(Senses),
		grants: v.exactOptional(v.pipe(v.array(Grant), v.minLength(1))),
		traits: v.exactOptional(v.pipe(v.array(InlineFeature), v.minLength(1))),
		resources: v.exactOptional(v.pipe(v.array(InlinePool), v.minLength(1))),
		lineages: v.exactOptional(v.pipe(v.array(lineageObject), v.minLength(1)))
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const problem = raceProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	})
);
export type Race = v.InferOutput<typeof Race>;
