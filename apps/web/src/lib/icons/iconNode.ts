/**
 * Server-side lucide icon-geometry resolver.
 *
 * Admins can pick ANY lucide icon by name, so we cannot ship a static
 * allowlist. We import lucide's `icons` barrel here — but ONLY on the
 * server (this module is imported solely by server data loaders), so the
 * registry never reaches the client bundle. We extract each icon's
 * lightweight `iconNode` (path-data array) and ship that JSON-safe data
 * with the page; the client renders the SVG with zero icon code.
 *
 * The barrel is a single module (cheap to compile), unlike lucide's
 * per-icon dynamic-import map which would force the bundler to process
 * ~1600 separate chunks.
 *
 * Server-only: keep this imported solely from server modules.
 */
import { icons } from "lucide-react";
import { DEFAULT_ICON, normalizeIconName } from "@store/shared";

import type { IconNode } from "@/lib/icons/types";

/**
 * lucide icon components are `forwardRef` objects. Their `render(props,
 * ref)` returns the inner `<Icon iconNode=... />` element, so its
 * `props.iconNode` is the geometry we want — no dynamic import needed.
 */
type LucideForwardRef = {
	render: (props: object, ref: unknown) => { props?: { iconNode?: IconNode } } | null;
};

const registry = icons as unknown as Record<string, LucideForwardRef | undefined>;

const nodeCache = new Map<string, IconNode>();

/**
 * Resolve a PascalCase icon name to its serializable `iconNode`. Unknown
 * names fall back to the default icon; anything unexpected resolves to an
 * empty node so a single bad name never breaks a render.
 */
export function resolveIconNode(name?: string): IconNode {
	const normalized = normalizeIconName(name, DEFAULT_ICON);
	const cached = nodeCache.get(normalized);
	if (cached) {
		return cached;
	}

	const component = registry[normalized] ?? registry[DEFAULT_ICON];
	const node = component?.render({}, null)?.props?.iconNode ?? [];
	nodeCache.set(normalized, node);
	return node;
}
