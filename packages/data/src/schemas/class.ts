import * as v from 'valibot';
import { ARMOR_CATEGORIES } from '../vocabulary.ts';
import { Ability, FormulaText, Id, Skill, Source, recordFields } from './common.ts';
import { InlineFeature, InlinePool, checkFeature, featureFields } from './feature.ts';

const NonEmpty = v.pipe(v.string(), v.trim(), v.nonEmpty());

/** A class or character level from 1 to 20. */
export const Level = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20));

const classFeatureObject = v.strictObject({
	...featureFields,
	level: Level,
	/** Later levels where this same feature returns, such as Ability Score Improvement. */
	alsoAtLevels: v.exactOptional(v.pipe(v.array(Level), v.minLength(1)))
});

/**
 * A class or context feature gained at `level`. The parent record's `source` cites the guide
 * text; `summary` is the review paraphrase.
 */
export const ClassFeature = v.pipe(
	classFeatureObject,
	checkFeature<v.InferOutput<typeof classFeatureObject>>()
);
export type ClassFeature = v.InferOutput<typeof ClassFeature>;

const GearItem = v.variant('kind', [
	v.strictObject({
		kind: v.picklist(['weapon', 'armor']),
		id: Id,
		count: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1)))
	}),
	v.strictObject({ kind: v.literal('note'), text: NonEmpty })
]);

/** One side of a starting-equipment choice, such as "chain mail" or "leather armor, longbow, and 20 arrows". */
const EquipmentOption = v.strictObject({
	id: Id,
	label: NonEmpty,
	items: v.pipe(v.array(GearItem), v.minLength(1))
});

const EquipmentChoice = v.strictObject({
	choose: v.literal(1),
	options: v.pipe(v.array(EquipmentOption), v.minLength(2))
});

const TechniqueRank = v.picklist(['untrained', 'familiar', 'practiced', 'mastered']);

/**
 * How a class invests technique or trick points. The catalog of techniques is a later record;
 * this block is only the rank costs and the improvised-use spend.
 */
const TechniqueTraining = v.strictObject({
	pointsAtFirst: v.pipe(v.number(), v.integer(), v.minValue(0)),
	pointsPerLevelAfterFirst: v.pipe(v.number(), v.integer(), v.minValue(0)),
	ranks: v.pipe(
		v.array(
			v.strictObject({
				rank: TechniqueRank,
				points: v.pipe(v.number(), v.integer(), v.minValue(0))
			})
		),
		v.minLength(1)
	),
	improvisedSpend: v.strictObject({ resource: Id, amount: FormulaText }),
	oncePerTurn: v.boolean(),
	saveDc: v.exactOptional(
		v.strictObject({
			base: FormulaText,
			ability: v.strictObject({
				kind: v.literal('choice'),
				of: v.pipe(v.array(Ability), v.minLength(2)),
				when: v.literal('gainTechnique')
			})
		})
	)
});

const FightingStyles = v.strictObject({
	source: Source,
	choose: v.pipe(v.number(), v.integer(), v.minValue(1)),
	replaceOn: v.picklist(['longRest']),
	anotherAtLevel: v.exactOptional(Level),
	options: v.pipe(v.array(InlineFeature), v.minLength(2))
});

/** A context nested on a class. Later tasks fill these in. */
export const Context = v.strictObject({
	id: Id,
	name: NonEmpty,
	source: Source,
	resources: v.exactOptional(v.pipe(v.array(InlinePool), v.minLength(1))),
	features: v.pipe(v.array(ClassFeature), v.minLength(1))
});
export type Context = v.InferOutput<typeof Context>;

interface ClassShape {
	readonly encodedLevels: { readonly from: number; readonly through: number };
	readonly proficiencies: {
		readonly skills: { readonly count: number; readonly of: ReadonlyArray<string> };
	};
	readonly features: ReadonlyArray<{
		readonly id: string;
		readonly level: number;
		readonly alsoAtLevels?: ReadonlyArray<number>;
		readonly spend?: ReadonlyArray<{ readonly resource: string }>;
	}>;
	readonly resources?: ReadonlyArray<{ readonly id: string }>;
	readonly fightingStyles?: {
		readonly choose: number;
		readonly options: ReadonlyArray<{ readonly id: string }>;
		readonly anotherAtLevel?: number;
	};
	readonly contexts?: ReadonlyArray<{
		readonly id: string;
		readonly features: ReadonlyArray<{ readonly id: string }>;
		readonly resources?: ReadonlyArray<{ readonly id: string }>;
	}>;
	readonly techniqueTraining?: { readonly improvisedSpend: { readonly resource: string } };
}

/** Returns why a class record is inconsistent, or `undefined` when it is fine. */
export function classProblem(record: ClassShape): string | undefined {
	const { from, through } = record.encodedLevels;
	if (from > through) return 'encodedLevels.from cannot be greater than through';
	if (record.proficiencies.skills.count > record.proficiencies.skills.of.length) {
		return 'Skill choices cannot exceed the number of skills listed';
	}

	const poolIds = new Set((record.resources ?? []).map((pool) => pool.id));
	const ids = [...poolIds];

	for (const feature of record.features) {
		if (feature.level < from || feature.level > through) {
			return `Feature "${feature.id}" is level ${String(feature.level)}, outside encoded levels ${String(from)}–${String(through)}`;
		}
		ids.push(feature.id);
		for (const spend of feature.spend ?? []) {
			if (!poolIds.has(spend.resource)) {
				return `Feature "${feature.id}" spends unknown resource "${spend.resource}"`;
			}
		}
	}

	const styles = record.fightingStyles;
	if (styles !== undefined) {
		if (styles.choose > styles.options.length)
			return 'choose cannot exceed the number of fighting styles';
		for (const option of styles.options) ids.push(option.id);
	}

	if (
		record.techniqueTraining !== undefined &&
		!poolIds.has(record.techniqueTraining.improvisedSpend.resource)
	) {
		return `Improvised techniques spend unknown resource "${record.techniqueTraining.improvisedSpend.resource}"`;
	}

	for (const context of record.contexts ?? []) {
		ids.push(context.id);
		for (const pool of context.resources ?? []) {
			if (poolIds.has(pool.id)) return `Context "${context.id}" repeats resource "${pool.id}"`;
			poolIds.add(pool.id);
			ids.push(pool.id);
		}
		for (const feature of context.features) ids.push(feature.id);
	}

	const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
	return duplicate === undefined ? undefined : `Duplicate id "${duplicate}"`;
}

/**
 * An Inazria class. v1 records set `encodedLevels` to 1–5; a feature outside that range is
 * rejected so a later level is not silently dropped into a partial record.
 */
export const Class = v.pipe(
	v.strictObject({
		...recordFields,
		archetype: v.picklist(['civil', 'primal']),
		tags: v.pipe(v.array(Id), v.minLength(1)),
		encodedLevels: v.strictObject({ from: Level, through: Level }),
		hitDie: v.picklist([6, 8, 10, 12]),
		hitPoints: v.strictObject({
			atFirst: FormulaText,
			perLevel: FormulaText,
			average: FormulaText
		}),
		proficiencies: v.strictObject({
			armor: v.array(v.picklist(ARMOR_CATEGORIES)),
			weapons: v.picklist(['none', 'simple', 'martial', 'simple-and-martial']),
			tools: v.array(NonEmpty),
			savingThrows: v.pipe(v.array(Ability), v.minLength(1)),
			skills: v.strictObject({
				count: v.pipe(v.number(), v.integer(), v.minValue(1)),
				of: v.pipe(v.array(Skill), v.minLength(1))
			})
		}),
		startingEquipment: v.pipe(v.array(EquipmentChoice), v.minLength(1)),
		classRules: v.strictObject({
			concentration: v.literal('asSpell'),
			oncePerTurnUnlessStated: v.boolean(),
			limitedUses: v.strictObject({
				max: FormulaText,
				recharge: v.literal('longRest')
			}),
			masteryBudget: v.exactOptional(Id),
			notSimulated: v.exactOptional(v.pipe(v.array(NonEmpty), v.minLength(1)))
		}),
		resources: v.exactOptional(v.pipe(v.array(InlinePool), v.minLength(1))),
		techniqueTraining: v.exactOptional(TechniqueTraining),
		fightingStyles: v.exactOptional(FightingStyles),
		features: v.pipe(v.array(ClassFeature), v.minLength(1)),
		contexts: v.exactOptional(v.pipe(v.array(Context), v.minLength(1)))
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const problem = classProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	})
);
export type Class = v.InferOutput<typeof Class>;
