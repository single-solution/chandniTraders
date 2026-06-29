import { Skeleton } from "@/components/ui/Skeleton";

export const DESKTOP_TRUST_CHIP_COUNT = 3;

export const HERO_TRUST_HINT_FALLBACK_COUNT = 3;
export const SHOP_TYPE_FALLBACK_COUNT = 6;
export const PROCESS_FLOW_FALLBACK_COUNT = 3;
export const PROCESS_STEP_FALLBACK_COUNT = 4;

export function MobileHeroFallback() {
	return (
		<section
			className="relative -mx-4 flex flex-col items-center justify-evenly border-b border-[var(--color-ink-100)] bg-gradient-to-b from-[var(--color-canvas-deep)] to-[var(--color-canvas)] px-4 text-center"
			style={{
				minHeight: "calc(100dvh - var(--mobile-header-h) - var(--mobile-tabbar-h))",
			}}
		>
			<div className="flex w-full flex-col items-center gap-2 px-3">
				<Skeleton shape="text" className="h-14 w-4/5" />
				<Skeleton shape="text" className="h-20 w-full" />
			</div>
			<Skeleton className="h-[150px] w-full" />
			<div className="flex w-full flex-col items-center gap-3">
				<Skeleton shape="pill" className="h-11 w-40" />
				<div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
					{Array.from({ length: HERO_TRUST_HINT_FALLBACK_COUNT }).map((_, index) => (
						<Skeleton key={index} shape="text" className="h-3 w-28" />
					))}
				</div>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Skeleton shape="text" className="h-2.5 w-24" />
				<Skeleton shape="circle" className="size-4" />
			</div>
		</section>
	);
}

export function MobileShopTypesFallback() {
	return (
		<section className="app-section">
			<div className="mb-3 space-y-2">
				<Skeleton shape="text" className="h-3 w-32" />
				<Skeleton shape="text" className="h-[80px] w-3/4" />
				<Skeleton shape="text" className="h-3 w-2/3" />
			</div>
			<div className="space-y-2.5">
				{Array.from({ length: SHOP_TYPE_FALLBACK_COUNT }).map((_, index) => (
					<div key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-4">
						<Skeleton className="size-12 shrink-0" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton shape="text" className="h-4 w-32" />
							<Skeleton shape="text" className="h-3 w-3/4" />
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export function MobileProcessFallback() {
	return (
		<section id="how-to-buy" className="app-section">
			<div className="mb-7 space-y-2 text-center">
				<Skeleton shape="text" className="mx-auto h-3 w-24" />
				<Skeleton shape="text" className="mx-auto h-12 w-3/4" />
				<Skeleton shape="text" className="mx-auto h-3 w-2/3" />
			</div>
			<div className="space-y-4">
				{Array.from({ length: PROCESS_FLOW_FALLBACK_COUNT }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
						<div className="flex items-center gap-2.5 bg-[var(--color-ink-900)] px-3.5 py-3">
							<Skeleton shape="circle" className="size-8 shrink-0" />
							<div className="min-w-0 flex-1 space-y-1.5">
								<Skeleton shape="text" className="h-2.5 w-16" />
								<Skeleton shape="text" className="h-3 w-32" />
							</div>
						</div>
						<ol>
							{Array.from({ length: PROCESS_STEP_FALLBACK_COUNT }).map((_, stepIndex) => (
								<li key={stepIndex} className="flex items-start gap-2.5 border-b border-[var(--color-ink-100)] px-3.5 py-3 last:border-b-0">
									<Skeleton shape="circle" className="size-6 shrink-0" />
									<div className="min-w-0 flex-1 space-y-1.5">
										<Skeleton shape="text" className="h-3 w-32" />
										<Skeleton shape="text" className="h-2.5 w-3/4" />
									</div>
								</li>
							))}
						</ol>
					</div>
				))}
			</div>
		</section>
	);
}

export function MobileVisitStoreFallback() {
	return (
		<section id="contact" className="app-section">
			<div className="mb-7 space-y-2 text-center">
				<Skeleton shape="text" className="mx-auto h-3 w-32" />
				<Skeleton shape="text" className="mx-auto h-12 w-3/4" />
				<Skeleton shape="text" className="mx-auto h-3 w-2/3" />
			</div>
			<div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
				<Skeleton className="aspect-[16/9] w-full rounded-none" />
				<div className="space-y-3 p-3.5">
					<div className="flex items-start gap-2.5">
						<Skeleton shape="circle" className="size-8 shrink-0" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton shape="text" className="h-3.5 w-40" />
							<Skeleton shape="text" className="h-3 w-2/3" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export function DesktopHeroFallback() {
	return (
		<section
			className="relative flex border-b border-[var(--color-ink-100)] bg-gradient-to-b from-[var(--color-canvas-deep)] to-[var(--color-canvas)]"
			style={{ minHeight: "calc(100dvh - var(--desktop-header-h))" }}
		>
			<div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-evenly px-6 text-center" style={{ minHeight: "calc(100dvh - var(--desktop-header-h))" }}>
				<div className="flex w-full flex-col items-center gap-3">
					<Skeleton shape="text" className="h-24 w-3/4" />
					<Skeleton shape="text" className="h-36 w-full max-w-3xl" />
				</div>
				<Skeleton className="h-[180px] w-full max-w-4xl" />
				<div className="flex flex-col items-center gap-6">
					<Skeleton shape="pill" className="h-12 w-48" />
					<div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
						{Array.from({ length: HERO_TRUST_HINT_FALLBACK_COUNT }).map((_, index) => (
							<Skeleton key={index} shape="text" className="h-4 w-40" />
						))}
					</div>
				</div>
				<div className="flex flex-col items-center gap-1">
					<Skeleton shape="text" className="h-3 w-28" />
					<Skeleton shape="circle" className="size-5" />
				</div>
			</div>
		</section>
	);
}

export function DesktopShopTypesFallback() {
	return (
		<section className="mx-auto w-full max-w-[1440px] px-4 py-24 sm:px-6 lg:px-8">
			<div className="space-y-3">
				<Skeleton shape="text" className="h-3 w-32" />
				<Skeleton shape="text" className="h-10 w-2/3" />
				<Skeleton shape="text" className="h-3 w-3/4" />
			</div>
			<div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
				{Array.from({ length: SHOP_TYPE_FALLBACK_COUNT }).map((_, index) => (
					<div key={index} className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-6">
						<Skeleton className="size-12" />
						<Skeleton shape="text" className="h-6 w-32" />
						<Skeleton shape="text" className="h-3 w-full" />
						<Skeleton shape="text" className="h-3 w-2/3" />
						<div className="flex gap-2">
							{Array.from({ length: DESKTOP_TRUST_CHIP_COUNT }).map((_, chipIndex) => (
								<Skeleton key={chipIndex} shape="pill" className="h-6 w-20" />
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

export function DesktopProcessFallback() {
	return (
		<section className="mx-auto w-full max-w-[1440px] px-4 py-24 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-2xl space-y-3 text-center">
				<Skeleton shape="text" className="mx-auto h-3 w-24" />
				<Skeleton shape="text" className="mx-auto h-12 w-3/4" />
				<Skeleton shape="text" className="mx-auto h-3 w-2/3" />
			</div>
			<div className="mt-12 grid grid-cols-3 gap-5">
				{Array.from({ length: PROCESS_FLOW_FALLBACK_COUNT }).map((_, index) => (
					<div key={index} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)]">
						<div className="space-y-2 bg-[var(--color-ink-900)] px-5 py-4">
							<Skeleton shape="text" className="h-2.5 w-16" />
							<Skeleton shape="text" className="h-4 w-32" />
						</div>
						<ol>
							{Array.from({ length: PROCESS_STEP_FALLBACK_COUNT }).map((_, stepIndex) => (
								<li key={stepIndex} className="flex items-start gap-3 border-b border-[var(--color-ink-100)] p-5 last:border-b-0">
									<Skeleton shape="circle" className="size-8 shrink-0" />
									<div className="min-w-0 flex-1 space-y-2">
										<Skeleton shape="text" className="h-3.5 w-32" />
										<Skeleton shape="text" className="h-3 w-full" />
									</div>
								</li>
							))}
						</ol>
					</div>
				))}
			</div>
		</section>
	);
}

export function DesktopVisitStoreFallback() {
	return (
		<section className="mx-auto w-full max-w-[1440px] px-4 py-24 sm:px-6 lg:px-8">
			<div className="grid grid-cols-2 gap-12">
				<div className="space-y-4">
					<Skeleton shape="text" className="h-3 w-32" />
					<Skeleton shape="text" className="h-12 w-3/4" />
					<Skeleton shape="text" className="h-3 w-full" />
					<Skeleton shape="text" className="h-3 w-2/3" />
				</div>
				<Skeleton className="aspect-[4/3] w-full" />
			</div>
		</section>
	);
}
