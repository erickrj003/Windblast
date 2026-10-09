/**
 * The twenty SRD 5.1 monsters the plan encodes first, from CR 1/8 to 5.
 * @rule srd51:monsters
 */
export const STARTER_MONSTER_IDS = [
	'kobold',
	'goblin',
	'bandit',
	'wolf',
	'skeleton',
	'zombie',
	'orc',
	'gnoll',
	'hobgoblin',
	'ghoul',
	'bugbear',
	'dire-wolf',
	'brown-bear',
	'giant-spider',
	'bandit-captain',
	'ogre',
	'owlbear',
	'veteran',
	'wight',
	'troll'
] as const;

/**
 * Returns the starter monster ids that are not among `present`, in list order.
 */
export function missingStarterMonsters(present: ReadonlySet<string>): ReadonlyArray<string> {
	return STARTER_MONSTER_IDS.filter((id) => !present.has(id));
}
