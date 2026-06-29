import clsx, { type ClassValue } from "clsx";

/**
 * Merge conditional class name fragments into a single string.
 * Thin wrapper over `clsx` so callers import a single shared helper
 * rather than reaching for the underlying library directly.
 */
export function classNames(...inputs: ClassValue[]): string {
	return clsx(inputs);
}
