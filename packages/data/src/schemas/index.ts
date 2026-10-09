import { Creature } from './creature.ts';
import { Armor, Weapon } from './equipment.ts';
import { Feature, ResourcePool } from './feature.ts';
import { Condition, DamageType } from './rules.ts';

/**
 * Content folders and the schema every record in them must satisfy. Records live at
 * `content/<srd|inazria>/<kind>/<id>.json`; later tasks add kinds (races, classes, contexts)
 * here as they encode them.
 */
export const CONTENT_SCHEMAS = {
	armor: Armor,
	conditions: Condition,
	'damage-types': DamageType,
	features: Feature,
	monsters: Creature,
	resources: ResourcePool,
	weapons: Weapon
} as const;

export type ContentKind = keyof typeof CONTENT_SCHEMAS;

/** The top-level content folders and the `source.kind` their records must cite. */
export const CONTENT_ROOTS = { srd: 'srd51', inazria: 'inazria' } as const;

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
export { ActionCost, Feature, InlineFeature, ResourcePool } from './feature.ts';
export { Condition, DamageType } from './rules.ts';
