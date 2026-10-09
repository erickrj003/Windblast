import * as v from 'valibot';
import { assertNever } from './assert-never.ts';
import type { Effect, Predicate } from './schemas/effect.ts';
import type { Weapon } from './schemas/equipment.ts';
import type { Creature } from './schemas/creature.ts';
import type { Feature } from './schemas/feature.ts';
import { CONTENT_ROOTS, CONTENT_SCHEMAS, type ContentKind } from './schemas/index.ts';
import type { Condition } from './schemas/rules.ts';

/** One content file, with its path relative to `packages/data/content/` using `/` separators. */
export interface ContentFile {
	readonly path: string;
	readonly text: string;
}

export interface ContentProblem {
	readonly path: string;
	readonly message: string;
}

/** A `scriptId` found on a record, so later tasks can require a matching engine module. */
export interface ScriptUse {
	readonly path: string;
	readonly at: string;
	readonly scriptId: string;
}

export interface ContentReport {
	readonly problems: ReadonlyArray<ContentProblem>;
	/** Valid records per content kind, sorted by kind. */
	readonly counts: ReadonlyArray<readonly [kind: string, count: number]>;
	readonly scripts: ReadonlyArray<ScriptUse>;
}

const isKey = <T extends object>(object: T, key: string): key is Extract<keyof T, string> =>
	Object.hasOwn(object, key);

interface Catalog {
	readonly ids: ReadonlyMap<ContentKind, ReadonlySet<string>>;
}

interface Ref {
	readonly at: string;
	readonly kind: ContentKind;
	readonly id: string;
}

/**
 * Validates content files: each must sit at `<srd|inazria>/<kind>/<id>.json`, parse as JSON,
 * satisfy the schema for its kind, use its file name as `id`, cite a source matching its top
 * folder, have an id unique within its kind, and name only damage types, conditions and other
 * records that exist. `scriptId` values are listed, not resolved — `data` cannot see `engine`.
 */
export function checkContent(files: ReadonlyArray<ContentFile>): ContentReport {
	const problems: ContentProblem[] = [];
	const counts = new Map<string, number>();
	const seen = new Map<string, string>();
	const ids = new Map<ContentKind, Set<string>>();
	const accepted: Array<{ path: string; kind: ContentKind; record: unknown }> = [];

	for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
		const report = (message: string): void => {
			problems.push({ path: file.path, message });
		};
		const parts = file.path.split('/');
		const [root, kind, name] = parts;
		if (parts.length !== 3 || root === undefined || kind === undefined || name === undefined) {
			report('Content files belong at <srd|inazria>/<kind>/<id>.json');
			continue;
		}
		if (!isKey(CONTENT_ROOTS, root)) {
			report(`Unknown content root "${root}"; expected ${Object.keys(CONTENT_ROOTS).join(' or ')}`);
			continue;
		}
		if (!isKey(CONTENT_SCHEMAS, kind)) {
			report(
				`Unknown content kind "${kind}"; expected one of ${Object.keys(CONTENT_SCHEMAS).join(', ')}`
			);
			continue;
		}
		if (!name.endsWith('.json')) {
			report('Content files must be .json');
			continue;
		}

		let json: unknown;
		try {
			json = JSON.parse(file.text);
		} catch (error) {
			report(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}

		const result = v.safeParse(CONTENT_SCHEMAS[kind], json);
		if (!result.success) {
			for (const issue of result.issues) {
				const at = v.getDotPath(issue);
				report(at === null ? issue.message : `${at}: ${issue.message}`);
			}
			continue;
		}

		const record = result.output;
		const id = name.slice(0, -'.json'.length);
		if (record.id !== id) report(`id "${record.id}" must match the file name "${id}"`);
		if (record.source.kind !== CONTENT_ROOTS[root]) {
			report(`Records under ${root}/ must cite source.kind "${CONTENT_ROOTS[root]}"`);
		}
		const key = `${kind}/${record.id}`;
		const earlier = seen.get(key);
		if (earlier === undefined) seen.set(key, file.path);
		else report(`Duplicate ${kind} id "${record.id}" (also in ${earlier})`);

		const bucket = ids.get(kind) ?? new Set<string>();
		bucket.add(record.id);
		ids.set(kind, bucket);
		accepted.push({ path: file.path, kind, record });
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}

	const catalog: Catalog = { ids };
	const scripts: ScriptUse[] = [];
	for (const { path, kind, record } of accepted) {
		for (const ref of [...collectRefs(kind, record)].sort((a, b) => (a.at < b.at ? -1 : 1))) {
			if (catalog.ids.get(ref.kind)?.has(ref.id) !== true) {
				problems.push({
					path,
					message: `${ref.at}: no ${ref.kind} record "${ref.id}"`
				});
			}
		}
		collectScripts(record, '', path, scripts);
	}

	scripts.sort((a, b) => (a.path === b.path ? (a.at < b.at ? -1 : 1) : a.path < b.path ? -1 : 1));
	return { problems, counts: [...counts].sort(([a], [b]) => (a < b ? -1 : 1)), scripts };
}

function collectRefs(kind: ContentKind, record: unknown): ReadonlyArray<Ref> {
	const refs: Ref[] = [];
	switch (kind) {
		case 'conditions': {
			const condition = record as Condition;
			(condition.implies ?? []).forEach((id, index) => {
				refs.push({ at: `implies.${String(index)}`, kind: 'conditions', id });
			});
			return refs;
		}
		case 'weapons': {
			const weapon = record as Weapon;
			if (weapon.damage !== undefined) {
				refs.push({ at: 'damage.type', kind: 'damage-types', id: weapon.damage.type });
			}
			return refs;
		}
		case 'monsters':
			return collectCreatureRefs(record as Creature);
		case 'features':
			return collectFeatureRefs(record as Feature);
		case 'armor':
		case 'damage-types':
		case 'resources':
			return refs;
		default:
			return assertNever(kind);
	}
}

function collectCreatureRefs(creature: Creature): ReadonlyArray<Ref> {
	const refs: Ref[] = [];
	const rules = (
		list: Creature['damageVulnerabilities'],
		field: 'damageVulnerabilities' | 'damageResistances' | 'damageImmunities'
	): void => {
		(list ?? []).forEach((rule, index) => {
			refs.push({ at: `${field}.${String(index)}.type`, kind: 'damage-types', id: rule.type });
		});
	};
	rules(creature.damageVulnerabilities, 'damageVulnerabilities');
	rules(creature.damageResistances, 'damageResistances');
	rules(creature.damageImmunities, 'damageImmunities');
	(creature.conditionImmunities ?? []).forEach((id, index) => {
		refs.push({ at: `conditionImmunities.${String(index)}`, kind: 'conditions', id });
	});
	(creature.traits ?? []).forEach((trait, index) => {
		refs.push(...collectEffects(trait.effects, `traits.${String(index)}.effects`));
		if (trait.condition !== undefined) {
			refs.push(...collectPredicate(trait.condition, `traits.${String(index)}.condition`));
		}
	});
	creature.actions.forEach((action, index) => {
		const at = `actions.${String(index)}`;
		if (action.kind === 'attack') {
			action.damage.forEach((line, lineIndex) => {
				refs.push({
					at: `${at}.damage.${String(lineIndex)}.type`,
					kind: 'damage-types',
					id: line.type
				});
			});
			(action.atRange ?? []).forEach((line, lineIndex) => {
				refs.push({
					at: `${at}.atRange.${String(lineIndex)}.type`,
					kind: 'damage-types',
					id: line.type
				});
			});
			(action.versatile ?? []).forEach((line, lineIndex) => {
				refs.push({
					at: `${at}.versatile.${String(lineIndex)}.type`,
					kind: 'damage-types',
					id: line.type
				});
			});
			if (action.onHit !== undefined) refs.push(...collectEffects(action.onHit, `${at}.onHit`));
		} else if (action.kind === 'feature') {
			refs.push(...collectEffects(action.effects, `${at}.effects`));
			if (action.condition !== undefined) {
				refs.push(...collectPredicate(action.condition, `${at}.condition`));
			}
		}
	});
	(creature.reactions ?? []).forEach((reaction, index) => {
		refs.push(...collectEffects(reaction.effects, `reactions.${String(index)}.effects`));
		if (reaction.condition !== undefined) {
			refs.push(...collectPredicate(reaction.condition, `reactions.${String(index)}.condition`));
		}
	});
	return refs;
}

function collectFeatureRefs(feature: Feature): ReadonlyArray<Ref> {
	const refs = [...collectEffects(feature.effects, 'effects')];
	if (feature.condition !== undefined) {
		refs.push(...collectPredicate(feature.condition, 'condition'));
	}
	return refs;
}

function collectEffects(effects: ReadonlyArray<Effect>, at: string): ReadonlyArray<Ref> {
	return effects.flatMap((effect, index) => collectEffect(effect, `${at}.${String(index)}`));
}

function collectEffect(effect: Effect, at: string): ReadonlyArray<Ref> {
	switch (effect.kind) {
		case 'save':
			return [
				...collectEffects(effect.onFail, `${at}.onFail`),
				...collectEffects(effect.onSuccess ?? [], `${at}.onSuccess`)
			];
		case 'conditional':
			return [
				...collectPredicate(effect.when, `${at}.when`),
				...collectEffects(effect.then, `${at}.then`)
			];
		case 'damage':
			return effect.damageType === 'weapon'
				? []
				: [{ at: `${at}.damageType`, kind: 'damage-types', id: effect.damageType }];
		case 'applyCondition':
		case 'removeCondition':
			return [{ at: `${at}.condition`, kind: 'conditions', id: effect.condition }];
		case 'attack':
		case 'heal':
		case 'modifyRoll':
		case 'spendResource':
		case 'gainResource':
		case 'move':
		case 'grantAction':
			return [];
		default:
			return assertNever(effect);
	}
}

function collectPredicate(predicate: Predicate, at: string): ReadonlyArray<Ref> {
	switch (predicate.kind) {
		case 'all':
		case 'any':
			return predicate.of.flatMap((part, index) =>
				collectPredicate(part, `${at}.of.${String(index)}`)
			);
		case 'not':
			return collectPredicate(predicate.predicate, `${at}.predicate`);
		case 'hasCondition':
			return [{ at: `${at}.condition`, kind: 'conditions', id: predicate.condition }];
		case 'attack':
		case 'weaponProperty':
		case 'wearingArmor':
		case 'rollMode':
		case 'hpBelowHalf':
		case 'creatureType':
		case 'hasTag':
		case 'creatureNear':
			return [];
		default:
			return assertNever(predicate);
	}
}

function collectScripts(value: unknown, at: string, path: string, out: ScriptUse[]): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			collectScripts(item, at === '' ? String(index) : `${at}.${String(index)}`, path, out);
		});
		return;
	}
	if (value === null || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	if (typeof record.scriptId === 'string') {
		out.push({ path, at: at === '' ? '.' : at, scriptId: record.scriptId });
	}
	for (const [key, child] of Object.entries(record)) {
		if (key === 'scriptId') continue;
		collectScripts(child, at === '' ? key : `${at}.${key}`, path, out);
	}
}
