import * as v from 'valibot';
import { Id, recordFields } from './common.ts';

const Text = v.pipe(v.string(), v.trim(), v.nonEmpty());

/**
 * A damage type. Types have no rules of their own; resistances and immunities refer to them.
 * @rule srd51:combat#damage-types
 */
export const DamageType = v.strictObject({ ...recordFields, description: Text });
export type DamageType = v.InferOutput<typeof DamageType>;

/**
 * A condition: its rules text for display, the conditions it includes (paralyzed includes
 * incapacitated) and, for exhaustion, the effect of each level. The engine implements the rules
 * per condition id.
 * @rule srd51:conditions
 */
export const Condition = v.pipe(
	v.strictObject({
		...recordFields,
		rules: v.pipe(v.array(Text), v.minLength(1)),
		implies: v.exactOptional(v.array(Id)),
		levels: v.exactOptional(v.pipe(v.array(Text), v.minLength(1)))
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const implies = dataset.value.implies ?? [];
		if (implies.includes(dataset.value.id))
			addIssue({ message: 'A condition cannot include itself' });
		if (new Set(implies).size !== implies.length) {
			addIssue({ message: 'List each included condition once' });
		}
	})
);
export type Condition = v.InferOutput<typeof Condition>;
