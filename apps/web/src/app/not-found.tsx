import { ButtonLink } from "@store/ui";

export default function NotFoundPage() {
	return (
		<div className="storefront-page-center mx-auto max-w-xl text-center">
			<p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent-700)] sm:text-xs">404</p>
			<h1 className="font-semibold mt-2 text-3xl leading-[0.95] tracking-tight text-[var(--color-ink-900)] sm:mt-3 sm:text-5xl lg:text-6xl">We can&apos;t find that page.</h1>
			<p className="mt-2.5 max-w-md text-[13px] text-[var(--color-ink-600)] sm:mt-3 sm:text-base">
				It may have moved, or the link could be wrong. Head back to the shop and we&apos;ll help you find what you&apos;re looking for.
			</p>
			<div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-7 sm:gap-3">
				<ButtonLink href="/" variant="primary" size="sm" className="md:h-11 md:px-5 md:text-sm">
					Go home
				</ButtonLink>
				<ButtonLink href="/" variant="outline" size="sm" className="md:h-11 md:px-5 md:text-sm">
					Browse products
				</ButtonLink>
			</div>
		</div>
	);
}
