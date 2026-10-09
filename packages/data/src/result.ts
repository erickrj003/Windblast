/** The outcome of an operation that can fail for expected reasons, such as invalid input. */
export type Result<T, E> =
	{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a successful value in a {@link Result}. */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/** Wraps an expected failure in a {@link Result}. */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}
