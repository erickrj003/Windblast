import { Class } from './class.ts';
import { Creature } from './creature.ts';
import { Armor, Weapon } from './equipment.ts';
import { Feature, ResourcePool } from './feature.ts';
import { Race } from './race.ts';
import { Condition, DamageType } from './rules.ts';

/**
 * Content folders and the schema every record in them must satisfy. Records live at
 * `content/<srd|inazria>/<kind>/<id>.json`; later tasks add kinds (contexts as their own
 * files, if a class record stops nesting them) here as they encode them.
 */
export const CONTENT_SCHEMAS = {
	armor: Armor,
	conditions: Condition,
	'damage-types': DamageType,
	classes: Class,
	features: Feature,
	monsters: Creature,
	races: Race,
	resources: ResourcePool,
	weapons: Weapon
} as const;

export type ContentKind = keyof typeof CONTENT_SCHEMAS;

/** The top-level content folders and the `source.kind` their records must cite. */
export const CONTENT_ROOTS = { srd: 'srd51', inazria: 'inazria' } as const;

export { Class, ClassFeature, Context, Level, classProblem } from './class.ts';
export { Ability, DiceText, Feet, FormulaText, Id, Skill, Source, Status } from './common.ts';
export { Creature } from './creature.ts';
export {
	Duration,
	Effect,
	Predicate,
	Role,
	RollKind,
	TargetSpec,
	Trigger,
	TriggerEvent
} from './effect.ts';
export { Armor, Weapon } from './equipment.ts';
export { ActionCost, Feature, InlineFeature, InlinePool, ResourcePool } from './feature.ts';
export {
	AbilityBonus,
	Grant,
	LanguageGrant,
	Lineage,
	Race,
	SAVE_AGAINST,
	grantProblem,
	raceProblem
} from './race.ts';
export { Condition, DamageType } from './rules.ts';
