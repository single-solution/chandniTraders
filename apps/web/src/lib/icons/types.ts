/**
 * Serializable lucide icon geometry.
 *
 * A lucide icon is just an array of `[svgChildTag, attributes]` pairs (the
 * `__iconNode` each lucide module exports). Shipping this tiny array with
 * server data lets us render any admin-chosen icon with full SSR and zero
 * client-side icon code — instead of bundling the entire lucide registry.
 */
export type IconNodeChild = [string, Record<string, string | number>];

export type IconNode = IconNodeChild[];
