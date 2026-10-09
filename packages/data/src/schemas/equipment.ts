import * as v from 'valibot';
import { WEAPON_PROPERTIES } from '../vocabulary.ts';
import { DiceText, Feet, Id, recordFields } from './common.ts';

const Int = v.pipe(v.number(), v.integer());

interface WeaponShape {
	readonly type: 'melee' | 'ranged';
	readonly damage?: unknown;
	readonly versatile?: unknown;
	readonly range?: { readonly normal: number; readonly long: number };
	readonly properties: ReadonlyArray<string>;
}

function weaponProblem(weapon: WeaponShape): string | undefined {
	const has = (property: string) => weapon.properties.includes(property);
	if (new Set(weapon.properties).size !== weapon.properties.length) {
		return 'List each weapon property once';
	}
	if (has('versatile') !== (weapon.versatile !== undefined)) {
		return 'A versatile weapon lists its two-handed damage in "versatile", and only versatile weapons do';
	}
	if ((has('ammunition') || has('thrown')) !== (weapon.range !== undefined)) {
		return 'Ammunition and thrown weapons need a range, and other weapons have none';
	}
	if (weapon.range !== undefined && weapon.range.long < weapon.range.normal) {
		return 'A weapon’s long range cannot be shorter than its normal range';
	}
	if (weapon.type === 'ranged' && !has('ammunition') && !has('thrown')) {
		return 'A ranged weapon either fires ammunition or is thrown';
	}
	if (weapon.damage === undefined && !has('special')) {
		return 'Only a weapon with special rules can deal no damage';
	}
	return undefined;
}

const WeaponObject = v.strictObject({
	...recordFields,
	category: v.picklist(['simple', 'martial']),
	type: v.picklist(['melee', 'ranged']),
	damage: v.exactOptional(v.strictObject({ dice: DiceText, type: Id })),
	versatile: v.exactOptional(DiceText),
	range: v.exactOptional(v.strictObject({ normal: Feet, long: Feet })),
	properties: v.array(v.picklist(WEAPON_PROPERTIES))
});

/**
 * A row of the Weapons table. `range` holds the property's numbers for ammunition and thrown
 * weapons; `versatile` holds the two-handed damage.
 * @rule srd51:equipment#weapons
 */
export const Weapon = v.pipe(
	WeaponObject,
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const problem = weaponProblem(dataset.value);
		if (problem !== undefined) addIssue({ message: problem });
	})
);
export type Weapon = v.InferOutput<typeof Weapon>;

/**
 * A row of the Armor table. Body armor gives a base AC plus all, some (`{ max }`) or none of the
 * wearer's Dexterity modifier; a shield adds a bonus.
 * @rule srd51:equipment#armor
 */
export const Armor = v.variant('category', [
	v.strictObject({
		...recordFields,
		category: v.picklist(['light', 'medium', 'heavy']),
		armorClass: v.pipe(Int, v.minValue(10), v.maxValue(30)),
		dexterity: v.union([
			v.literal('full'),
			v.literal('none'),
			v.strictObject({ max: v.pipe(Int, v.minValue(0)) })
		]),
		strength: v.exactOptional(v.pipe(Int, v.minValue(1), v.maxValue(30))),
		stealthDisadvantage: v.boolean()
	}),
	v.strictObject({
		...recordFields,
		category: v.literal('shield'),
		armorClassBonus: v.pipe(Int, v.minValue(1))
	})
]);
export type Armor = v.InferOutput<typeof Armor>;
