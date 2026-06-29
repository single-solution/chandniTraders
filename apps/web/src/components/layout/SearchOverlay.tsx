"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Search, TrendingUp, X } from "lucide-react";
import { classNames, formatPrice, type Product, type StoredImage } from "@store/shared";

import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import { usePresence } from "@/components/shared/motion/usePresence";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";
import { productHref } from "@/lib/catalog/productPaths";
import { Input } from "@/components/ui/Input";

interface SearchOverlayProps {
	isOpen: boolean;
	onClose: () => void;
}

interface SearchResult {
	id: string;
	slug: string;
	categorySlug: string;
	name: string;
	brandSlug: string;
	brandName: string;
	image: StoredImage | null;
	variantCount: number;
	fromPriceRupees: number;
}

const DEBOUNCE_MS = 220;
const MIN_QUERY_LEN = 2;
const AUTOFOCUS_DELAY_MS = 60;
const SEARCH_RESULTS_LIMIT = 10;
/** Recently updated products shown in the empty search state. */
const RECENT_PRODUCTS_LIMIT = 6;
/** Skeleton placeholder rows shown while results load. */
const SKELETON_PLACEHOLDER_ROWS = 4;
/** Matches the `sheet-fade-out` exit duration in globals.css. */
const SEARCH_EXIT_MS = 200;

const RECENT_SEARCHES_KEY = "storefront-recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
	const { isMounted, status } = usePresence(isOpen, SEARCH_EXIT_MS);
	const isClosing = status === "closing";
	const overlayRef = useRef<HTMLDivElement | null>(null);
	useFocusTrap(overlayRef, isOpen);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hints, setHints] = useState<string[]>([]);
	const [recentSearches, setRecentSearches] = useState<string[]>([]);
	const [recentProducts, setRecentProducts] = useState<SearchResult[]>([]);
	const [isHydrated, setIsHydrated] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const router = useRouter();
	const { startNavigation } = useNavigationTransition();

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required for safe hydration
		setIsHydrated(true);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			// Reset the overlay's transient state when the parent closes us so the
			// next open starts blank. Single command-on-prop-change.
			// eslint-disable-next-line react-hooks/set-state-in-effect -- close-time reset of overlay-local state
			setQuery("");
			setResults([]);
			setHints([]);
			setRecentProducts([]);
			return;
		}

		try {
			const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
			if (stored) {
				setRecentSearches(JSON.parse(stored).slice(0, MAX_RECENT_SEARCHES));
			}
		} catch {
			// ignore
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const focusTimer = window.setTimeout(() => {
			inputRef.current?.focus();
		}, AUTOFOCUS_DELAY_MS);

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", handleKeyDown);
			window.clearTimeout(focusTimer);
		};
	}, [isOpen, onClose]);

	// Fetch a fresh set of hint chips each time the overlay opens. The
	// server-side mix is randomized, so every open gets a different blend
	// of categories / top sellers / bottom sellers.
	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const controller = new AbortController();
		fetch("/api/search/hints", { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : { hints: [] }))
			.then((data: { hints?: string[] }) => {
				setHints(Array.isArray(data.hints) ? data.hints : []);
			})
			.catch((error) => {
				if (!(error instanceof DOMException) || error.name !== "AbortError") {
					setHints([]);
				}
			});
		return () => controller.abort();
	}, [isOpen]);

	// Recently updated products — fills the empty search state when the query is blank.
	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const controller = new AbortController();
		fetch(`/api/products?limit=${RECENT_PRODUCTS_LIMIT}&sort=recently-updated`, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : { products: [] }))
			.then((data: { products?: Product[] }) => {
				setRecentProducts((data.products ?? []).map(toSearchResult));
			})
			.catch((error) => {
				if (!(error instanceof DOMException) || error.name !== "AbortError") {
					setRecentProducts([]);
				}
			});
		return () => controller.abort();
	}, [isOpen]);

	// Debounced fetch against /api/search.
	useEffect(() => {
		const trimmed = query.trim();
		if (trimmed.length < MIN_QUERY_LEN) {
			// Query too short — clear stale matches so the dropdown doesn't keep
			// showing the previous answer mid-typing.
			// eslint-disable-next-line react-hooks/set-state-in-effect -- input-driven reset
			setResults([]);
			setIsLoading(false);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			setIsLoading(true);
			try {
				const response = await fetch(`/api/search?query=${encodeURIComponent(trimmed)}&limit=${SEARCH_RESULTS_LIMIT}`, { signal: controller.signal });
				if (!response.ok) {
					setResults([]);
					return;
				}
				const data = (await response.json()) as { results: SearchResult[] };
				setResults(data.results ?? []);
			} catch (error) {
				if (!(error instanceof DOMException) || error.name !== "AbortError") {
					setResults([]);
				}
			} finally {
				setIsLoading(false);
			}
		}, DEBOUNCE_MS);

		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [query]);

	function submitSearch(value: string) {
		const trimmed = value.trim();
		if (!trimmed) {
			return;
		}

		try {
			const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
			const recent = stored ? JSON.parse(stored) : [];
			const updated = [trimmed, ...recent.filter((q: string) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
			window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
		} catch {
			// ignore
		}

		onClose();
		const url = `/?q=${encodeURIComponent(trimmed)}`;
		startNavigation(() => router.push(url));
	}

	if (!isMounted || !isHydrated) {
		return null;
	}

	const overlayElement = (
		<div
			ref={overlayRef}
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			className={classNames("fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[var(--color-canvas)] outline-none", isClosing ? "animate-sheet-fade-out" : "animate-sheet-fade")}
		>
			<div
				className="safe-top sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas)] px-2 py-2 md:mx-auto md:w-full md:max-w-5xl md:px-4 md:py-3"
				style={{ "--safe-top-base": "0.5rem" } as CSSProperties}
			>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close search"
					className="tap focus-ring grid size-10 place-items-center rounded-full text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-canvas-deep)] active:bg-[var(--color-surface-muted)]"
				>
					<ArrowLeft size={20} />
				</button>
				<form
					className="relative flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						submitSearch(query);
					}}
				>
					<Input
						ref={inputRef}
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search products, brands, categories…"
						aria-label="Search products"
						autoComplete="off"
						spellCheck={false}
						icon={<Search size={16} />}
						variant="search"
						inputSize="md"
						rounded="full"
						isLoading={isLoading}
					/>
					{query && (
						<button
							type="button"
							aria-label="Clear"
							onClick={() => setQuery("")}
							className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[var(--color-ink-500)] active:bg-[var(--color-surface-muted)]"
						>
							<X size={16} />
						</button>
					)}
				</form>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 md:mx-auto md:w-full md:max-w-5xl">
				{query.trim().length < MIN_QUERY_LEN ? (
					<SearchEmptyState hints={hints} recentSearches={recentSearches} recentProducts={recentProducts} onPick={(value) => submitSearch(value)} onNavigate={onClose} />
				) : isLoading && results.length === 0 ? (
					<SearchSkeleton />
				) : results.length === 0 ? (
					<NoResults query={query.trim()} onSearchAll={() => submitSearch(query)} />
				) : (
					<ul key={query} className="sheet-stagger space-y-1.5">
						{results.map((result) => (
							<SearchHit key={result.id} result={result} onNavigate={onClose} />
						))}
						<li className="pt-2">
							<button
								type="button"
								onClick={() => submitSearch(query)}
								className="block w-full rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--color-accent-800)] active:bg-[var(--color-surface-muted)]"
							>
								See all results for &ldquo;{query.trim()}&rdquo;
							</button>
						</li>
					</ul>
				)}
			</div>
		</div>
	);

	return createPortal(overlayElement, document.body);
}

import { useGlobalEagerLoad } from "@/lib/useGlobalEagerLoad";

interface SearchHitProps {
	result: SearchResult;
	onNavigate: () => void;
}

function SearchHit({ result, onNavigate }: SearchHitProps) {
	const href = result.categorySlug && result.slug ? productHref({ categorySlug: result.categorySlug, slug: result.slug }) : "/";
	const thumb = result.image?.variants.thumb ?? null;
	const globalEager = useGlobalEagerLoad();

	return (
		<li>
			<Link
				href={href}
				onClick={onNavigate}
				className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-canvas-deep)] px-3 py-3 active:bg-[var(--color-surface-muted)]"
			>
				<span className="product-media-well grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-surface)] text-xs font-semibold uppercase text-[var(--color-ink-500)]">
					{thumb ? (
						// eslint-disable-next-line @next/next/no-img-element -- search thumbnail, no need for next/image
						<img src={thumb} alt="" className="size-full object-cover" loading={globalEager ? "eager" : "lazy"} />
					) : (
						(result.brandName || result.name).charAt(0).toUpperCase()
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5">
						<p className="truncate text-sm font-semibold text-[var(--color-ink-900)]">{result.name}</p>
						<span className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-canvas)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--color-ink-500)]">
							{result.brandName}
						</span>
					</div>
					<p className="truncate text-xs text-[var(--color-ink-500)]">
						{result.variantCount} option{result.variantCount === 1 ? "" : "s"}
						{result.fromPriceRupees > 0 ? ` · from ${formatPrice(result.fromPriceRupees)}` : ""}
					</p>
				</div>
			</Link>
		</li>
	);
}

interface SearchEmptyStateProps {
	hints: string[];
	recentSearches: string[];
	recentProducts: SearchResult[];
	onPick: (value: string) => void;
	onNavigate: () => void;
}

function SearchEmptyState({ hints, recentSearches, recentProducts, onPick, onNavigate }: SearchEmptyStateProps) {
	if (hints.length === 0 && recentSearches.length === 0 && recentProducts.length === 0) {
		return null;
	}
	return (
		<div className="space-y-8">
			{recentSearches.length > 0 && (
				<div>
					<h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">
						<History size={12} />
						Recent searches
					</h3>
					<div className="sheet-stagger mt-3 flex flex-wrap gap-2">
						{recentSearches.map((search) => (
							<button
								key={search}
								type="button"
								onClick={() => onPick(search)}
								className={classNames(
									"tap rounded-[var(--radius-full)] border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] active:bg-[var(--color-surface-muted)]",
								)}
							>
								{search}
							</button>
						))}
					</div>
				</div>
			)}

			{hints.length > 0 && (
				<div>
					<h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">
						<TrendingUp size={12} />
						Suggested
					</h3>
					<div className="sheet-stagger mt-3 flex flex-wrap gap-2">
						{hints.map((hint) => (
							<button
								key={hint}
								type="button"
								onClick={() => onPick(hint)}
								className={classNames(
									"tap rounded-[var(--radius-full)] border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink-700)] active:bg-[var(--color-surface-muted)]",
								)}
							>
								{hint}
							</button>
						))}
					</div>
				</div>
			)}

			{recentProducts.length > 0 && (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">Recent products</h3>
					<ul className="sheet-stagger mt-3 space-y-1.5">
						{recentProducts.map((result) => (
							<SearchHit key={result.id} result={result} onNavigate={onNavigate} />
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function toSearchResult(product: Product): SearchResult {
	const minPrice = product.variants.length ? Math.min(...product.variants.map((variant) => variant.priceRupees)) : 0;
	return {
		id: product.id,
		slug: product.slug,
		categorySlug: product.categorySlug,
		name: product.name,
		brandSlug: product.brandSlug,
		brandName: product.brandName,
		image: product.images?.[0] ?? null,
		variantCount: product.variants.length,
		fromPriceRupees: minPrice,
	};
}

function SearchSkeleton() {
	return (
		<ul aria-busy className="space-y-1.5">
			{Array.from({ length: SKELETON_PLACEHOLDER_ROWS }).map((_, index) => (
				<li key={index} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-canvas-deep)] px-3 py-3">
					<span className="skeleton size-12 shrink-0" />
					<div className="flex-1 space-y-1.5">
						<span className="skeleton block h-3 w-2/3" />
						<span className="skeleton block h-2 w-1/3" />
					</div>
				</li>
			))}
		</ul>
	);
}

interface NoResultsProps {
	query: string;
	onSearchAll: () => void;
}

function NoResults({ query, onSearchAll }: NoResultsProps) {
	return (
		<div className="mx-auto max-w-xs pt-12 text-center">
			<p className="text-base font-semibold text-[var(--color-ink-800)]">No matches for &ldquo;{query}&rdquo;</p>
			<p className="mt-1 text-sm text-[var(--color-ink-500)]">Try a brand, a model, or a category like &ldquo;ceiling fans&rdquo; or &ldquo;room coolers&rdquo;.</p>
			<button
				type="button"
				onClick={onSearchAll}
				className="mt-4 inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-ink-800)] hover:border-[var(--color-ink-300)]"
			>
				Search all products →
			</button>
		</div>
	);
}
