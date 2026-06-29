import { cache } from "react";

import {
	composeBrandSeo as composeBrandSeoFn,
	composeCategorySeo as composeCategorySeoFn,
	composeHomeSeo as composeHomeSeoFn,
	composeOfferSeo as composeOfferSeoFn,
	composeProductSeo as composeProductSeoFn,
} from "@store/shared";

export type { BrandSeoRef, CategorySeoRef, ResolvedSeoMeta, SeoSettings } from "@store/shared";

/** Per-render dedupe — `generateMetadata` and the page body share one pass. */
export const composeBrandSeo = cache(composeBrandSeoFn);
export const composeCategorySeo = cache(composeCategorySeoFn);
export const composeHomeSeo = cache(composeHomeSeoFn);
export const composeOfferSeo = cache(composeOfferSeoFn);
export const composeProductSeo = cache(composeProductSeoFn);
