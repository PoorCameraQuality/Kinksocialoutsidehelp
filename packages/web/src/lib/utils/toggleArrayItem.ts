/**
 * Toggle an item in an array: add if absent, remove if present.
 * Uses reference equality for primitives; for objects, use a custom predicate.
 */
export function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((element) => element !== item) : [...arr, item]
}
