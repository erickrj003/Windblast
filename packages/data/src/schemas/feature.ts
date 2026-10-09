import * as v from 'valibot';
import { FormulaText, Id, recordFields } from './common.ts';
import { Effect, Predicate, Trigger } from './effect.ts';

/** What using a feature costs in the action economy. `none` covers passive and free features. */
export const ActionCost = v.picklist(['none', 'action', 'bonusAction', 'reaction']);
export type ActionCost = v.InferOutput<typeof ActionCost>;

const PoolRecharge = v.array(
	v.strictObject({
		on: v.picklist(['initiative', 'turnStart', 'shortRest', 'longRest']),
		regain: FormulaText
	})
);

/**
 * A pool defined inside another record, such as a race trait's limited uses. Pools start full;
 * `regain: "pool-max"` restores all of it.
 */
export const InlinePool = v.strictObject({
	id: Id,
	name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	max: FormulaText,
	recharge: PoolRecharge
});
export type InlinePool = v.InferOutput<typeof InlinePool>;

/**
 * A pool that fuels features: Exertion, Devotion, Focus Points, Guile, spell slots, or a
 * feature's own limited uses. Pools start full; `regain: "pool-max"` restores all of it.
 */
export const ResourcePool = v.strictObject({
	...recordFields,
	max: FormulaText,
	recharge: PoolRecharge
});
export type ResourcePool = v.InferOutput<typeof ResourcePool>;

/** The fields shared by standalone and inline features. */
export const featureFields = {
	id: Id,
	name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	summary: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('A feature needs a one-line summary for review')
	),
	cost: ActionCost,
	trigger: v.exactOptional(Trigger),
	condition: v.exactOptional(Predicate),
	spend: v.exactOptional(
		v.pipe(v.array(v.strictObject({ resource: Id, amount: FormulaText })), v.minLength(1))
	),
	limit: v.exactOptional(v.picklist(['oncePerTurn', 'oncePerRound'])),
	effects: v.array(Effect),
	scriptId: v.exactOptional(Id),
	noEffect: v.exactOptional(
		v.pipe(v.string(), v.trim(), v.nonEmpty('Say why this feature is not simulated'))
	)
};

interface FeatureShape {
	readonly cost: ActionCost;
	readonly trigger?: Trigger;
	readonly effects: ReadonlyArray<Effect>;
	readonly scriptId?: string;
	readonly noEffect?: string;
}

/** Returns why a feature is inconsistent, or `undefined` when it is fine. */
export function featureProblem(feature: FeatureShape): string | undefined {
	if (feature.noEffect !== undefined) {
		if (feature.effects.length > 0 || feature.scriptId !== undefined) {
			return 'noEffect cannot be combined with effects or a scriptId';
		}
		return undefined;
	}
	if (feature.effects.length === 0 && feature.scriptId === undefined) {
		return 'A feature needs effects, a scriptId naming its engine module, or a noEffect reason';
	}
	if (feature.cost === 'reaction' && feature.trigger === undefined) {
		return 'A reaction needs a trigger';
	}
	return undefined;
}

/** A pipe step that rejects features failing {@link featureProblem}. */
export function checkFeature<T extends FeatureShape>(): v.RawCheckAction<T> {
	return v.rawCheck<T>(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const problem = featureProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	});
}

const inlineFeatureObject = v.strictObject(featureFields);

/** A feature defined inside another record, such as a monster's trait or reaction. */
export const InlineFeature = v.pipe(
	inlineFeatureObject,
	checkFeature<v.InferOutput<typeof inlineFeatureObject>>()
);
export type InlineFeature = v.InferOutput<typeof InlineFeature>;

const featureObject = v.strictObject({ ...recordFields, ...featureFields });

/**
 * A class, context or race feature in its own file. `summary` is a short paraphrase for
 * review screens; the cited guide section stays the authority.
 */
export const Feature = v.pipe(featureObject, checkFeature<v.InferOutput<typeof featureObject>>());
export type Feature = v.InferOutput<typeof Feature>;
