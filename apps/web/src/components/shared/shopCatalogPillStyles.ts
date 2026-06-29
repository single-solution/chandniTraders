import { classNames } from "@store/shared";

export const SHOP_CATALOG_PILL_BASE =
	"shop-catalog-pill tap focus-ring inline-flex items-center gap-1 rounded-[var(--radius-full)] border px-3 py-1.5 text-[12px] font-medium tracking-tight md:px-3.5 md:py-2 md:text-[13px]";

export function shopCatalogPillClass(isActive: boolean): string {
	return classNames(
		SHOP_CATALOG_PILL_BASE,
		isActive
			? "border-[var(--color-accent-400)] bg-[var(--color-accent-100)] text-[var(--color-accent-800)]"
			: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-800)] hover:-translate-y-px hover:border-[var(--color-accent-300)] hover:bg-[var(--color-canvas-deep)] active:translate-y-0",
	);
}
