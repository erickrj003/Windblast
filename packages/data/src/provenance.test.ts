import { describe, expect, it } from 'vitest';
import { extractSection } from './provenance.ts';

const PAGE = [
	'## Fighter',
	'',
	'Intro text.',
	'',
	'### Core Class Features',
	'- **Martial Proficiency (1st Level)**. Your training covers arms.  ',
	'- **Exertion (1st Level)**. You can push your body.',
	'  - **Second Wind** (1 Exertion, bonus action). You regain hit points.',
	'',
	'  - **Action Surge** (2 Exertion, on your turn). One more action.',
	'- **Combat Techniques (1st Level)**. The full catalog.',
	'',
	'## Fighter Techniques',
	'',
	'### Offensive',
	'',
	'| Technique | Trigger |',
	'|---|---|',
	'| **Cleave** | Immediately after a melee weapon attack hits |',
	'| **Heavy Blow** | When you hit with a weapon attack |',
	'',
	'### Tarvanin',
	'',
	'| **Ambush Cut** | After Quick Change |',
	'',
	'## Contexts',
	'',
	'### Tarvanin',
	'',
	'Tarvanin are guerrilla fighters.',
	'',
	'- **Quick Change (1st Level)**. Swap weapons.',
	''
].join('\r\n');

function section(name: string): string {
	const result = extractSection(PAGE, name);
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

describe('extractSection', () => {
	it('returns a heading through the next heading of the same or higher level', () => {
		expect(section('Fighter Techniques > Offensive')).toBe(
			[
				'### Offensive',
				'',
				'| Technique | Trigger |',
				'|---|---|',
				'| **Cleave** | Immediately after a melee weapon attack hits |',
				'| **Heavy Blow** | When you hit with a weapon attack |'
			].join('\n')
		);
		expect(section('Fighter')).toContain('- **Combat Techniques (1st Level)**');
		expect(section('Fighter')).not.toContain('## Fighter Techniques');
	});

	it('returns a bold list item with its nested lines, without trailing spaces', () => {
		expect(section('Core Class Features > Exertion (1st Level)')).toBe(
			[
				'- **Exertion (1st Level)**. You can push your body.',
				'  - **Second Wind** (1 Exertion, bonus action). You regain hit points.',
				'',
				'  - **Action Surge** (2 Exertion, on your turn). One more action.'
			].join('\n')
		);
		expect(section('Martial Proficiency (1st Level)')).toBe(
			'- **Martial Proficiency (1st Level)**. Your training covers arms.'
		);
		expect(section('Exertion (1st Level) ')).toContain('Action Surge');
	});

	it('finds nested list items and table rows', () => {
		expect(section('Second Wind')).toBe(
			'- **Second Wind** (1 Exertion, bonus action). You regain hit points.'
		);
		expect(section('Offensive > Cleave')).toBe(
			'| **Cleave** | Immediately after a melee weapon attack hits |'
		);
	});

	it('uses parent headings to tell repeated names apart', () => {
		expect(extractSection(PAGE, 'Tarvanin')).toEqual({
			ok: false,
			error: 'Section "Tarvanin": "Tarvanin" matches 2 headings; add a parent heading'
		});
		expect(section('Contexts > Tarvanin')).toContain('Quick Change');
		expect(section('Fighter Techniques > Tarvanin')).toBe(
			'### Tarvanin\n\n| **Ambush Cut** | After Quick Change |'
		);
	});

	it('rejects missing, ambiguous and malformed paths', () => {
		const error = (name: string): string => {
			const result = extractSection(PAGE, name);
			return result.ok ? '' : result.error;
		};
		expect(error('Paladin')).toContain('no heading, bold list item or table row "Paladin"');
		expect(error('Paladin > Devotion')).toContain('no heading "Paladin"');
		expect(error('Contexts > Cleave')).toContain(
			'no heading, bold list item or table row "Cleave"'
		);
		expect(error('Fighter >  > Offensive')).toContain('empty name');
		expect(extractSection('- **Rally** one\n- **Rally** two', 'Rally')).toEqual({
			ok: false,
			error: 'Section "Rally": "Rally" matches 2 items; add a parent heading'
		});
	});
});
