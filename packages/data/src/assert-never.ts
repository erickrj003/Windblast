/**
 * Marks the end of an exhaustive `switch` over a discriminated union. TypeScript reports an
 * error at the call site if any member is unhandled; at runtime it throws, because reaching it
 * means data from outside the type system (for example a corrupted save) slipped through.
 */
export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
