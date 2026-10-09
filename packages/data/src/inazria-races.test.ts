import { describe, expect, it } from 'vitest';
import { INAZRIA_RACE_IDS, missingInazriaRaces } from './inazria-races.ts';

describe('INAZRIA_RACE_IDS', () => {
	it('lists each published player race once', () => {
		expect(INAZRIA_RACE_IDS).toHaveLength(8);
		expect(new Set(INAZRIA_RACE_IDS).size).toBe(8);
	});

	it('reports published races that are missing from content', () => {
		expect(missingInazriaRaces(new Set(INAZRIA_RACE_IDS))).toEqual([]);
		expect(missingInazriaRaces(new Set(['human', 'elf']))).toEqual(
			INAZRIA_RACE_IDS.filter((id) => id !== 'human' && id !== 'elf')
		);
	});
});
