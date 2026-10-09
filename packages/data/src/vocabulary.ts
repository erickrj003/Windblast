/**
 * Fixed SRD 5.1 vocabularies. Open-ended lists that Inazria may extend (damage types,
 * conditions) are content records instead, referenced by id.
 */

/**
 * The six ability scores, abbreviated as in stat blocks.
 * @rule srd51:using-ability-scores#ability-scores-and-modifiers
 */
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityId = (typeof ABILITIES)[number];

/**
 * The eighteen skills and their kebab-case ids.
 * @rule srd51:using-ability-scores#skills
 */
export const SKILLS = [
	'acrobatics',
	'animal-handling',
	'arcana',
	'athletics',
	'deception',
	'history',
	'insight',
	'intimidation',
	'investigation',
	'medicine',
	'nature',
	'perception',
	'performance',
	'persuasion',
	'religion',
	'sleight-of-hand',
	'stealth',
	'survival'
] as const;
export type SkillId = (typeof SKILLS)[number];

/**
 * Creature sizes.
 * @rule srd51:monsters#size
 */
export const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type Size = (typeof SIZES)[number];

/**
 * Creature types.
 * @rule srd51:monsters#type
 */
export const CREATURE_TYPES = [
	'aberration',
	'beast',
	'celestial',
	'construct',
	'dragon',
	'elemental',
	'fey',
	'fiend',
	'giant',
	'humanoid',
	'monstrosity',
	'ooze',
	'plant',
	'undead'
] as const;
export type CreatureType = (typeof CREATURE_TYPES)[number];

/**
 * Weapon properties as listed in the Weapons table. The Range property is a weapon's `range`
 * field rather than an entry here, because the table only gives it inside ammunition and thrown.
 * @rule srd51:equipment#weapon-properties
 */
export const WEAPON_PROPERTIES = [
	'ammunition',
	'finesse',
	'heavy',
	'light',
	'loading',
	'reach',
	'special',
	'thrown',
	'two-handed',
	'versatile'
] as const;
export type WeaponProperty = (typeof WEAPON_PROPERTIES)[number];

/**
 * Armor categories, plus shields.
 * @rule srd51:equipment#armor-and-shields
 */
export const ARMOR_CATEGORIES = ['light', 'medium', 'heavy', 'shield'] as const;
export type ArmorCategory = (typeof ARMOR_CATEGORIES)[number];

/**
 * Challenge ratings as written in stat blocks.
 * @rule srd51:monsters#challenge
 */
export const CHALLENGE_RATINGS = [
	'0',
	'1/8',
	'1/4',
	'1/2',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'11',
	'12',
	'13',
	'14',
	'15',
	'16',
	'17',
	'18',
	'19',
	'20',
	'21',
	'22',
	'23',
	'24',
	'25',
	'26',
	'27',
	'28',
	'29',
	'30'
] as const;
export type ChallengeRating = (typeof CHALLENGE_RATINGS)[number];
