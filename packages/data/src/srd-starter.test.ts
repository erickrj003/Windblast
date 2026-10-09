import { describe, expect, it } from 'vitest';
import { STARTER_MONSTER_IDS, missingStarterMonsters } from './srd-starter.ts';

describe('starter SRD monsters [srd51:monsters]', () => {
	it('lists twenty unique ids', () => {
		expect(STARTER_MONSTER_IDS).toHaveLength(20);
		expect(new Set(STARTER_MONSTER_IDS).size).toBe(20);
	});

	it('reports which of the twenty records are missing', () => {
		expect(missingStarterMonsters(new Set(STARTER_MONSTER_IDS))).toEqual([]);
		expect(missingStarterMonsters(new Set(['wolf', 'troll']))).toEqual(
			STARTER_MONSTER_IDS.filter((id) => id !== 'wolf' && id !== 'troll')
		);
	});
});
