import * as v from 'valibot';
import { isSelfContained } from '../formula/format.ts';
import { parseFormula } from '../formula/parse.ts';
import { ABILITIES, SKILLS } from '../vocabulary.ts';

/** A kebab-case content id. It must match the record's file name. */
export const Id = v.pipe(
	v.string(),
	v.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		'Ids are kebab-case: lowercase letters, digits and single hyphens'
	)
);
export type Id = v.InferOutput<typeof Id>;

export const Ability = v.picklist(ABILITIES);
export const Skill = v.picklist(SKILLS);

/** A non-negative whole number of feet. */
export const Feet = v.pipe(v.number(), v.integer(), v.minValue(0));

/** A formula string such as `1d10 + level(fighter)`; see `parseFormula` for the grammar. */
export const FormulaText = v.pipe(
	v.string(),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const result = parseFormula(dataset.value);
		if (!result.ok) addIssue({ message: result.error });
	})
);

/** Dice that read nothing from a creature, such as a monster's `2d6 + 3` damage. */
export const DiceText = v.pipe(
	FormulaText,
	v.check((text) => {
		const result = parseFormula(text);
		return result.ok && isSelfContained(result.value);
	}, 'Stat block dice cannot use pb, level, mod, table, pool-max or weapon-die')
);

/**
 * Rules status. Only `final` records are used unless the user includes draft rules;
 * `blocked` records wait on an open question.
 */
export const Status = v.picklist(['final', 'draft', 'blocked']);
export type Status = v.InferOutput<typeof Status>;

const PagePath = v.pipe(
	v.string(),
	v.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
		'Pages are kebab-case paths such as classes/civil/fighter'
	)
);
const Section = v.pipe(v.string(), v.trim(), v.nonEmpty('A source names the section it encodes'));

/**
 * Where a record's rules come from. Inazria sources pin the guide commit and the hash of the
 * cited section, so `check-provenance` can flag records whose source text changed.
 */
export const Source = v.variant('kind', [
	v.strictObject({
		kind: v.literal('inazria'),
		page: PagePath,
		section: Section,
		commit: v.pipe(
			v.string(),
			v.regex(/^[0-9a-f]{40}$/, 'commit is a 40-character lowercase git SHA')
		),
		contentHash: v.pipe(
			v.string(),
			v.regex(/^[0-9a-f]{64}$/, 'contentHash is a 64-character lowercase SHA-256 hex digest')
		)
	}),
	v.strictObject({
		kind: v.literal('srd51'),
		page: PagePath,
		section: Section
	})
]);
export type Source = v.InferOutput<typeof Source>;

/** Fields every content record carries. */
export const recordFields = {
	id: Id,
	name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	source: Source,
	status: Status
};
