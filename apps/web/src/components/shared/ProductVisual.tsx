import { classNames } from "@store/shared";

interface ProductVisualProps {
	brandName: string;
	modelName: string;
	colorName: string;
	brandSlug: string;
	className?: string;
	size?: "sm" | "md" | "lg";
}

/* Brand gradients are restricted to the palette (ink + accent ramps)
   so the placeholder stays inside the brand colour system. Each brand
   gets its own pair of palette stops to keep visual variety, but the
   palette is the only source of truth. */
const BRAND_GRADIENTS: Record<string, [string, string]> = {
	royal: ["var(--color-ink-800)", "var(--color-ink-900)"],
	pak: ["var(--color-ink-700)", "var(--color-ink-900)"],
	google: ["var(--color-accent-800)", "var(--color-ink-900)"],
	xiaomi: ["var(--color-accent-700)", "var(--color-ink-900)"],
	oneplus: ["var(--color-ink-900)", "var(--color-ink-700)"],
	oppo: ["var(--color-ink-600)", "var(--color-ink-900)"],
	vivo: ["var(--color-ink-700)", "var(--color-accent-800)"],
	huawei: ["var(--color-ink-800)", "var(--color-ink-900)"],
};

const FALLBACK_GRADIENT: [string, string] = ["var(--color-ink-600)", "var(--color-ink-900)"];

/**
 * Generic image-missing fallback for a product card or PDP hero.
 *
 * Renders a brand-tinted gradient surface with the brand + model name
 * centered on it. Brand-agnostic by design — no product-shaped SVG.
 */
export function ProductVisual({ brandName, modelName, colorName, brandSlug, className, size = "md" }: ProductVisualProps) {
	const [gradientFrom, gradientTo] = BRAND_GRADIENTS[brandSlug] ?? FALLBACK_GRADIENT;

	return (
		<div
			className={classNames("relative flex h-full w-full items-center justify-center overflow-hidden", className)}
			style={{
				background: `radial-gradient(circle at 30% 20%, ${gradientFrom}, ${gradientTo})`,
			}}
			role="img"
			aria-label={colorName ? `${brandName} ${modelName} in ${colorName}` : `${brandName} ${modelName}`}
		>
			<div className="relative z-10 flex flex-col items-center gap-1 px-4 text-center text-[var(--color-on-dark-strong)]">
				<span
					className={classNames(
						"font-semibold uppercase tracking-[0.18em] text-[var(--color-on-dark-soft)]",
						size === "sm" && "text-[9px]",
						size === "md" && "text-[10px]",
						size === "lg" && "text-[11px]",
					)}
				>
					{brandName}
				</span>
				<span className={classNames("line-clamp-2 font-medium leading-tight", size === "sm" && "text-[12px]", size === "md" && "text-[14px]", size === "lg" && "text-[16px]")}>
					{modelName}
				</span>
			</div>

			<div className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-[var(--color-on-dark-10)] blur-2xl" />
			<div className="pointer-events-none absolute -left-12 -bottom-16 size-40 rounded-full bg-[var(--color-on-dark-05)] blur-3xl" />
		</div>
	);
}
