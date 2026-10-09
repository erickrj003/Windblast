/**
 * Published Inazria player races. Te-Hyzalians are omitted: the guide says they are not a
 * player option.
 * @rule inazria:races
 */
export const INAZRIA_RACE_IDS = [
	'human',
	'elf',
	'dwarf',
	'halfling',
	'orc',
	'dalvas',
	'kelanari',
	'hyzalian'
] as const;

/**
 * Returns the published race ids that are not among `present`, in list order.
 */
export function missingInazriaRaces(present: ReadonlySet<string>): ReadonlyArray<string> {
	return INAZRIA_RACE_IDS.filter((id) => !present.has(id));
}
