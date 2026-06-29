import { extractComparisonQueries, formatCatalogProductsMarkdownTable, type CustomerMessageLanguage, type Product } from "@store/shared";

import { productToCatalogTableRow } from "@/lib/chat/assistant/catalogProductFormat";
import { searchAssistantCatalogCached } from "@/lib/core/cached";

async function resolveTopProduct(query: string): Promise<Product | null> {
	const matches = await searchAssistantCatalogCached({
		search: query.slice(0, 80),
		limit: 3,
	});
	return matches[0] ?? null;
}

export async function buildCatalogComparisonFallback(input: {
	customerMessage: string;
	requiredLanguage: CustomerMessageLanguage;
}): Promise<string[] | null> {
	const queries = extractComparisonQueries(input.customerMessage);
	if (queries.length < 2) {
		return null;
	}

	const resolved = await Promise.all(
		queries.map(async (query) => ({
			query,
			product: await resolveTopProduct(query),
		})),
	);

	if (!resolved.some((row) => row.product)) {
		return null;
	}

	const table = formatCatalogProductsMarkdownTable(
		resolved.map(({ query, product }) =>
			product
				? productToCatalogTableRow(product)
				: {
						name: query,
						priceSummary: "—",
						stockLabel: "not listed",
						linkPath: "/",
					},
		),
	);
	if (!table) {
		return null;
	}

	const isUrdu = input.requiredLanguage === "roman_urdu" || input.requiredLanguage === "urdu_script";
	const allFound = resolved.every((row) => row.product);

	if (isUrdu) {
		return [
			allFound
				? "Dono models ki live comparison — jo abhi catalog mein hai:"
				: "Jo match mila us hisaab se live comparison:",
			table,
			"Camera, battery, ya iOS vs Android pe focus karna hai? Bata dein, main ek clear recommend kar dun ga.",
		];
	}

	return [
		allFound
			? "Great question — here's a live side-by-side from our catalog:"
			: "Here's what we have in stock for that comparison (some models may need sourcing):",
		table,
		"Tell me your priority — camera, battery, or iOS vs Android — and I'll recommend one.",
	];
}
