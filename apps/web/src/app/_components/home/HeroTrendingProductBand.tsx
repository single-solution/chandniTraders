"use client";

import { useEffect, useState } from "react";

import { classNames } from "@store/shared";

import { HeroMaskSweepHeadline } from "@/app/_components/home/HeroMaskSweepHeadline";

type BandVariant = "mobile" | "desktop";
type FlankSide = "left" | "right";
type HeadlineDensity = "default" | "compact";

interface FlankSlot {
	size: "sm" | "md" | "lg";
	top: number;
	/** Offset from the center-facing edge (%), shop banner mid-flank spread. */
	offset: number;
	name: string;
}

const DESKTOP_SIZE_CLASS: Record<FlankSlot["size"], string> = {
	lg: "text-[22px]",
	md: "text-[17px]",
	sm: "text-sm",
};

const DESKTOP_SIZE_CLASS_COMPACT: Record<FlankSlot["size"], string> = {
	lg: "text-[18px]",
	md: "text-[15px]",
	sm: "text-[13px]",
};

const MOBILE_SIZE_CLASS: Record<FlankSlot["size"], string> = {
	lg: "text-[15px]",
	md: "text-[13px]",
	sm: "text-[11px]",
};

const MOBILE_SIZE_CLASS_COMPACT: Record<FlankSlot["size"], string> = {
	lg: "text-[13px]",
	md: "text-[11px]",
	sm: "text-[10px]",
};

const DESKTOP_COLUMN_HEIGHT = "self-stretch";
const MOBILE_COLUMN_HEIGHT = "self-stretch";

function generateFlankSlots(count: number, products: string[], side: FlankSide, wideSpread = false): FlankSlot[] {
	if (products.length === 0) {
		return [];
	}

	const sizes: FlankSlot["size"][] = ["sm", "md", "lg", "md", "sm"];
	const shuffledProducts = [...products].sort(() => Math.random() - 0.5);
	const sideOffset = side === "left" ? 0 : 1;
	const slots: FlankSlot[] = [];

	for (let index = 0; index < count; index += 1) {
		const productIndex = (index * 2 + sideOffset) % shuffledProducts.length;
		const top = 12 + ((index + 1) / (count + 1)) * 76 + (Math.random() - 0.5) * 8;
		// Keep anchors off the outer column edge so long names keep side-bearing room.
		const offset = wideSpread ? 32 + Math.round(Math.random() * 28) : 0;

		slots.push({
			size: sizes[index % sizes.length] ?? "md",
			top,
			offset,
			name: shuffledProducts[productIndex] ?? "",
		});
	}

	return slots.sort(() => Math.random() - 0.5);
}

interface HeroTrendingProductBandProps {
	productNames: string[];
	variant: BandVariant;
	side: FlankSide;
	density?: HeadlineDensity;
}

export function HeroTrendingProductBand({ productNames, variant, side, density = "default" }: HeroTrendingProductBandProps) {
	const [labels, setLabels] = useState<FlankSlot[]>([]);

	const isCompact = density === "compact";
	const wideSpread = isCompact;
	const popCycle = variant === "desktop" ? 8 : 6;
	const count = variant === "desktop" ? 3 : 2;

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setLabels(generateFlankSlots(count, productNames, side, wideSpread));
		}, 600);

		return () => window.clearTimeout(timer);
	}, [productNames, count, side, wideSpread]);
	const sizeClass = variant === "desktop" ? (isCompact ? DESKTOP_SIZE_CLASS_COMPACT : DESKTOP_SIZE_CLASS) : isCompact ? MOBILE_SIZE_CLASS_COMPACT : MOBILE_SIZE_CLASS;
	const columnHeight = variant === "desktop" ? DESKTOP_COLUMN_HEIGHT : MOBILE_COLUMN_HEIGHT;
	const columnWidth = wideSpread
		? side === "left"
			? "min-w-0 w-full py-1 pl-2.5 sm:pl-3 md:pl-4"
			: "min-w-0 w-full py-1 pr-2.5 sm:pr-3 md:pr-4"
		: variant === "desktop"
			? "min-w-[96px] flex-1"
			: "min-w-[44px] max-w-[96px] flex-1 sm:max-w-[120px]";
	const anchorClass = wideSpread ? (side === "left" ? "text-right" : "text-left") : side === "left" ? "right-0 text-right" : "left-0 text-left";

	if (productNames.length === 0) {
		return <div className={classNames("shrink-0", columnWidth, columnHeight)} aria-hidden />;
	}

	return (
		<div className={classNames("relative", columnWidth, columnHeight)} aria-hidden>
			{labels.map((item, index) => {
				const delay = (popCycle / Math.max(labels.length, 1)) * index;
				return (
					<span
						key={`${side}-${item.name}-${index}`}
						className={classNames("hero-product-pop-flank pointer-events-none absolute whitespace-nowrap font-medium tracking-tight", sizeClass[item.size], anchorClass)}
						style={{
							top: `${item.top}%`,
							...(wideSpread ? (side === "left" ? { right: `${item.offset}%` } : { left: `${item.offset}%` }) : {}),
							animationDuration: `${popCycle}s`,
							animationDelay: `${delay}s`,
							animationIterationCount: "infinite",
						}}
					>
						{item.name}
					</span>
				);
			})}
		</div>
	);
}

interface HeroHeadlineWithTrendingProductsProps {
	productNames: string[];
	variant: BandVariant;
	density?: HeadlineDensity;
}

/** Inspected / Trusted lockup with cycling product names flanking each side. */
export function HeroHeadlineWithTrendingProducts({ productNames, variant, density = "default" }: HeroHeadlineWithTrendingProductsProps) {
	const wideSpread = density === "compact";

	return (
		<div
			className={classNames(
				"w-full min-w-0 items-stretch",
				wideSpread ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 sm:gap-x-5 md:gap-x-8 lg:gap-x-10" : "flex justify-between gap-2 sm:gap-3 md:gap-5 lg:gap-6",
			)}
		>
			<HeroTrendingProductBand productNames={productNames} variant={variant} side="left" density={density} />
			<div className={classNames("shrink-0 self-center justify-self-center px-0.5", density === "compact" ? "py-1.5 md:py-2" : "py-1")}>
				<HeroMaskSweepHeadline variant={variant} density={density} />
			</div>
			<HeroTrendingProductBand productNames={productNames} variant={variant} side="right" density={density} />
		</div>
	);
}
