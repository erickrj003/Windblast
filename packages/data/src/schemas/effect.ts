import * as v from 'valibot';
import type { AbilityId, ArmorCategory, WeaponProperty } from '../vocabulary.ts';
import { ARMOR_CATEGORIES, WEAPON_PROPERTIES } from '../vocabulary.ts';
import { Ability, Feet, FormulaText, Id } from './common.ts';

/**
 * Who a predicate or effect refers to, relative to the event being handled:
 * `self` owns the feature, `actor` caused the event, `target` received it.
 */
export const Role = v.picklist(['self', 'actor', 'target']);
export type Role = v.InferOutput<typeof Role>;

/** Engine events that features can react to. */
export const TriggerEvent = v.picklist([
	'initiative',
	'turnStart',
	'turnEnd',
	'attackRoll',
	'hit',
	'miss',
	'criticalHit',
	'damaged',
	'savingThrow',
	'saveFailed',
	'saveSucceeded',
	'move',
	'enterReach',
	'leaveReach',
	'reducedToZero',
	'spellCast',
	'shortRest',
	'longRest'
]);
export type TriggerEvent = v.InferOutput<typeof TriggerEvent>;

/**
 * When a feature fires: on an event, with the feature's owner in a given role. For example
 * "when you hit" is `{ on: 'hit', as: 'actor' }` and "when you are hit" is
 * `{ on: 'hit', as: 'target' }`; `observer` covers events between other creatures.
 */
export const Trigger = v.strictObject({
	on: TriggerEvent,
	as: v.picklist(['actor', 'target', 'observer'])
});
export type Trigger = v.InferOutput<typeof Trigger>;

/** How long an applied effect lasts. One minute is 10 rounds. */
export const Duration = v.variant('kind', [
	v.strictObject({ kind: v.literal('instant') }),
	v.strictObject({
		kind: v.literal('untilTurn'),
		edge: v.picklist(['start', 'end']),
		whose: Role,
		which: v.picklist(['current', 'next'])
	}),
	v.strictObject({
		kind: v.literal('rounds'),
		count: v.pipe(v.number(), v.integer(), v.minValue(1))
	})
]);
export type Duration = v.InferOutput<typeof Duration>;

/** Which creatures an effect applies to. */
export const TargetSpec = v.union([
	Role,
	v.strictObject({
		kind: v.literal('creatures'),
		side: v.picklist(['ally', 'enemy', 'any']),
		within: Feet,
		of: Role,
		count: v.union([v.pipe(v.number(), v.integer(), v.minValue(1)), v.literal('all')]),
		includeSelf: v.exactOptional(v.boolean())
	})
]);
export type TargetSpec = v.InferOutput<typeof TargetSpec>;

/** Rolls that `modifyRoll` can change. */
export const RollKind = v.picklist([
	'attack',
	'damage',
	'savingThrow',
	'abilityCheck',
	'initiative',
	'deathSave'
]);

/**
 * A condition under which a feature applies. Recursive through `all`, `any` and `not`, so its
 * type is written out once here and the schema is checked against it.
 */
export type Predicate =
	| { readonly kind: 'all'; readonly of: ReadonlyArray<Predicate> }
	| { readonly kind: 'any'; readonly of: ReadonlyArray<Predicate> }
	| { readonly kind: 'not'; readonly predicate: Predicate }
	| {
			readonly kind: 'attack';
			readonly range?: 'melee' | 'ranged';
			readonly with?: 'weapon' | 'spell' | 'unarmed';
	  }
	| { readonly kind: 'weaponProperty'; readonly property: WeaponProperty }
	| { readonly kind: 'wearingArmor'; readonly who: Role; readonly category: ArmorCategory | 'any' }
	| { readonly kind: 'hasCondition'; readonly who: Role; readonly condition: string }
	| { readonly kind: 'rollMode'; readonly mode: 'advantage' | 'disadvantage' }
	| { readonly kind: 'hpBelowHalf'; readonly who: Role }
	| {
			readonly kind: 'creatureNear';
			readonly of: Role;
			readonly within: number;
			readonly side: 'ally' | 'enemy';
			readonly excluding?: Role;
	  };

export const Predicate: v.GenericSchema<Predicate> = v.variant('kind', [
	v.strictObject({
		kind: v.literal('all'),
		of: v.pipe(v.array(v.lazy(() => Predicate)), v.minLength(2))
	}),
	v.strictObject({
		kind: v.literal('any'),
		of: v.pipe(v.array(v.lazy(() => Predicate)), v.minLength(2))
	}),
	v.strictObject({ kind: v.literal('not'), predicate: v.lazy(() => Predicate) }),
	v.strictObject({
		kind: v.literal('attack'),
		range: v.exactOptional(v.picklist(['melee', 'ranged'])),
		with: v.exactOptional(v.picklist(['weapon', 'spell', 'unarmed']))
	}),
	v.strictObject({ kind: v.literal('weaponProperty'), property: v.picklist(WEAPON_PROPERTIES) }),
	v.strictObject({
		kind: v.literal('wearingArmor'),
		who: Role,
		category: v.union([v.picklist(ARMOR_CATEGORIES), v.literal('any')])
	}),
	v.strictObject({ kind: v.literal('hasCondition'), who: Role, condition: Id }),
	v.strictObject({ kind: v.literal('rollMode'), mode: v.picklist(['advantage', 'disadvantage']) }),
	v.strictObject({ kind: v.literal('hpBelowHalf'), who: Role }),
	v.strictObject({
		kind: v.literal('creatureNear'),
		of: Role,
		within: Feet,
		side: v.picklist(['ally', 'enemy']),
		excluding: v.exactOptional(Role)
	})
]);

/**
 * One step of a feature's behavior, from the plan's declarative vocabulary. Recursive because a
 * `save` carries the effects of failing or succeeding.
 */
export type Effect =
	| {
			readonly kind: 'attack';
			readonly with: 'weapon' | 'unarmed';
			readonly range?: 'melee' | 'ranged';
			readonly target: TargetSpec;
	  }
	| {
			readonly kind: 'save';
			readonly ability: AbilityId;
			readonly dc: string;
			readonly target: TargetSpec;
			readonly onFail: ReadonlyArray<Effect>;
			readonly onSuccess?: ReadonlyArray<Effect>;
	  }
	| {
			readonly kind: 'damage';
			readonly amount: string;
			readonly damageType: string;
			readonly target: TargetSpec;
			readonly budget?: string;
	  }
	| {
			readonly kind: 'heal';
			readonly amount: string;
			readonly target: TargetSpec;
			readonly temporary?: boolean;
	  }
	| {
			readonly kind: 'applyCondition';
			readonly condition: string;
			readonly target: TargetSpec;
			readonly duration: Duration;
	  }
	| { readonly kind: 'removeCondition'; readonly condition: string; readonly target: TargetSpec }
	| {
			readonly kind: 'modifyRoll';
			readonly roll: v.InferOutput<typeof RollKind>;
			readonly mode: 'advantage' | 'disadvantage' | 'bonus' | 'reroll';
			readonly amount?: string;
			readonly target: TargetSpec;
			readonly duration?: Duration;
	  }
	| { readonly kind: 'spendResource'; readonly resource: string; readonly amount: string }
	| {
			readonly kind: 'gainResource';
			readonly resource: string;
			readonly amount: string;
			readonly target?: TargetSpec;
	  }
	| {
			readonly kind: 'move';
			readonly who: TargetSpec;
			readonly feet: string;
			readonly direction: 'any' | 'away' | 'toward';
			readonly provokes: boolean;
	  }
	| {
			readonly kind: 'grantAction';
			readonly action: 'action' | 'bonusAction' | 'reaction' | 'attack';
			readonly count?: number;
	  };

const Effects = v.array(v.lazy(() => Effect));

const effectVariant = v.variant('kind', [
	v.strictObject({
		kind: v.literal('attack'),
		with: v.picklist(['weapon', 'unarmed']),
		range: v.exactOptional(v.picklist(['melee', 'ranged'])),
		target: TargetSpec
	}),
	v.strictObject({
		kind: v.literal('save'),
		ability: Ability,
		dc: FormulaText,
		target: TargetSpec,
		onFail: v.pipe(Effects, v.minLength(1)),
		onSuccess: v.exactOptional(v.pipe(Effects, v.minLength(1)))
	}),
	v.strictObject({
		kind: v.literal('damage'),
		amount: FormulaText,
		damageType: v.union([Id, v.literal('weapon')]),
		target: TargetSpec,
		budget: v.exactOptional(Id)
	}),
	v.strictObject({
		kind: v.literal('heal'),
		amount: FormulaText,
		target: TargetSpec,
		temporary: v.exactOptional(v.boolean())
	}),
	v.strictObject({
		kind: v.literal('applyCondition'),
		condition: Id,
		target: TargetSpec,
		duration: Duration
	}),
	v.strictObject({ kind: v.literal('removeCondition'), condition: Id, target: TargetSpec }),
	v.strictObject({
		kind: v.literal('modifyRoll'),
		roll: RollKind,
		mode: v.picklist(['advantage', 'disadvantage', 'bonus', 'reroll']),
		amount: v.exactOptional(FormulaText),
		target: TargetSpec,
		duration: v.exactOptional(Duration)
	}),
	v.strictObject({ kind: v.literal('spendResource'), resource: Id, amount: FormulaText }),
	v.strictObject({
		kind: v.literal('gainResource'),
		resource: Id,
		amount: FormulaText,
		target: v.exactOptional(TargetSpec)
	}),
	v.strictObject({
		kind: v.literal('move'),
		who: TargetSpec,
		feet: FormulaText,
		direction: v.picklist(['any', 'away', 'toward']),
		provokes: v.boolean()
	}),
	v.strictObject({
		kind: v.literal('grantAction'),
		action: v.picklist(['action', 'bonusAction', 'reaction', 'attack']),
		count: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(1)))
	})
]);

export const Effect: v.GenericSchema<Effect> = v.pipe(
	effectVariant,
	v.check(
		(effect) =>
			effect.kind !== 'modifyRoll' || (effect.mode === 'bonus') === (effect.amount !== undefined),
		'modifyRoll needs an amount exactly when mode is "bonus"'
	)
);
