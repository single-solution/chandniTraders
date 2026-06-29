import { getPaymentMethodLabel } from "../constants";
import { formatOfferDiscountLabel } from "../pricing/offerDisplay";
import type { ActiveOffer } from "../pricing/offerEvaluator";
import { isCheckoutNoticeOffer } from "../pricing/offerMatching";
import { isCatalogDealOffer } from "../pricing/offerScope";

/** Cap table rows so chat bubbles stay readable on mobile. */
export const ASSISTANT_DEAL_TABLE_MAX_ROWS = 12;

function escapeMarkdownTableCell(value: string): string {
	return value.replace(/\|/g, " ").replace(/\n/g, " ").trim();
}

function formatOfferEndLabel(endDate?: Date | string): string {
	if (!endDate) {
		return "—";
	}
	if (endDate instanceof Date) {
		return endDate.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
	}
	const iso = String(endDate).slice(0, 10);
	if (!iso) {
		return "—";
	}
	const parsed = new Date(`${iso}T12:00:00`);
	return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}

function resolveOfferTypeLabel(offer: ActiveOffer): string {
	if (isCheckoutNoticeOffer(offer)) {
		return "Checkout";
	}
	if (isCatalogDealOffer(offer)) {
		return "Catalog";
	}
	return "Offer";
}

function describeOfferWhen(offer: ActiveOffer): string {
	const hints: string[] = [];
	for (const condition of offer.conditions) {
		if (condition.type === "cart_total" && condition.operator === "gte") {
			hints.push(`Cart ${Number(condition.value).toLocaleString("en-PK")}+`);
		}
		if (condition.type === "payment_method") {
			const methods = Array.isArray(condition.value) ? condition.value : [condition.value];
			hints.push(methods.map((method) => getPaymentMethodLabel(String(method))).join(" / "));
		}
	}
	return hints.length > 0 ? hints.join(" · ") : "—";
}

/** Markdown table for chat UI — server-authored only. */
export function formatActiveDealsMarkdownTable(
	offers: ActiveOffer[],
	maxRows = ASSISTANT_DEAL_TABLE_MAX_ROWS,
): string | undefined {
	const visible = offers.filter((offer) => offer.title?.trim()).slice(0, maxRows);
	if (visible.length === 0) {
		return undefined;
	}

	const rows = visible.map((offer) => {
		const title = escapeMarkdownTableCell(offer.title.trim());
		const saving = escapeMarkdownTableCell(formatOfferDiscountLabel(offer.action));
		const when = escapeMarkdownTableCell(describeOfferWhen(offer));
		const type = escapeMarkdownTableCell(resolveOfferTypeLabel(offer));
		const until = escapeMarkdownTableCell(formatOfferEndLabel(offer.schedule.endDate));
		return `| ${title} | **${saving}** | ${when} | ${type} | ${until} |`;
	});

	const overflow =
		offers.length > visible.length
			? `\n| +${offers.length - visible.length} more deals | [View all](/deals) | | | |`
			: "";

	return ["| Deal | Saving | When | Type | Until |", "| --- | --- | --- | --- | --- |", ...rows].join("\n") + overflow;
}

export interface AssistantCatalogTableRow {
	name: string;
	priceSummary: string;
	stockLabel: string;
	linkPath: string;
}

/** Markdown table for in-stock catalog matches in chat bubbles. */
export function formatCatalogProductsMarkdownTable(
	rows: AssistantCatalogTableRow[],
	maxRows = 8,
): string | undefined {
	const visible = rows.slice(0, maxRows);
	if (visible.length === 0) {
		return undefined;
	}

	const tableRows = visible.map((row) => {
		const name = escapeMarkdownTableCell(row.name);
		const price = escapeMarkdownTableCell(row.priceSummary);
		const stock = escapeMarkdownTableCell(row.stockLabel);
		return `| **${name}** | **${price}** | ${stock} | [View](${row.linkPath}) |`;
	});

	const overflow =
		rows.length > visible.length ? `\n| +${rows.length - visible.length} more | [Browse shop](/) | | | |` : "";

	return ["| Product | From | Stock | Link |", "| --- | --- | --- | --- |", ...tableRows].join("\n") + overflow;
}

/** Split deal answers into intro, table, and follow-up bubbles. */
export function buildDealListMessageChunks(input: { intro: string; outro: string; offers: ActiveOffer[] }): string[] {
	const table = formatActiveDealsMarkdownTable(input.offers);
	if (!table) {
		return [input.intro.trim()];
	}
	const chunks = [input.intro.trim(), table];
	if (input.outro.trim()) {
		chunks.push(input.outro.trim());
	}
	return chunks;
}

/** Legacy pipe-style bullet lists → markdown table for older stored messages. */
export function convertPipeBulletDealsToMarkdownTable(body: string): string {
	const lines = body.split("\n");
	const bulletLines = lines.filter((line) => /^\s*-\s+.+\|.+\|/.test(line));
	if (bulletLines.length < 3) {
		return body;
	}

	const rows = bulletLines.map((line) => {
		const content = line.replace(/^\s*-\s+/, "");
		const parts = content.split("|").map((part) => escapeMarkdownTableCell(part.trim()));
		const title = parts[0] ?? "";
		const saving = parts[1] ?? "";
		const when = parts.find((part) => part.startsWith("when:"))?.replace(/^when:\s*/i, "") ?? "—";
		const ends = parts.find((part) => part.startsWith("ends "))?.replace(/^ends\s*/i, "") ?? "—";
		const type = parts.find((part) => /catalog deal|checkout promo/i.test(part)) ?? "—";
		return `| ${title} | **${saving}** | ${when} | ${type} | ${ends} |`;
	});

	const table = ["| Deal | Saving | When | Type | Until |", "| --- | --- | --- | --- | --- |", ...rows].join("\n");
	const firstBulletIndex = lines.findIndex((line) => /^\s*-\s+.+\|.+\|/.test(line));
	let lastBulletIndex = firstBulletIndex;
	for (let index = firstBulletIndex + 1; index < lines.length; index += 1) {
		if (/^\s*-\s+.+\|.+\|/.test(lines[index] ?? "")) {
			lastBulletIndex = index;
		}
	}
	const before = lines.slice(0, firstBulletIndex).join("\n").trim();
	const after = lines.slice(lastBulletIndex + 1).join("\n").trim();
	return [before, table, after].filter(Boolean).join("\n\n");
}

/** Split one message into intro / table / outro when a markdown table is embedded. */
export function splitMessageOnMarkdownTable(body: string): string[] {
	const normalized = convertPipeBulletDealsToMarkdownTable(body.trim());
	const lines = normalized.split("\n");
	const tableStart = lines.findIndex((line) => /^\|\s*.+\|\s*$/.test(line.trim()));
	if (tableStart < 0) {
		return normalized.trim() ? [normalized.trim()] : [];
	}

	let tableEnd = tableStart;
	while (tableEnd + 1 < lines.length && /^\|\s*.+\|\s*$/.test(lines[tableEnd + 1]?.trim() ?? "")) {
		tableEnd += 1;
	}

	const before = lines.slice(0, tableStart).join("\n").trim();
	const table = lines.slice(tableStart, tableEnd + 1).join("\n").trim();
	const after = lines.slice(tableEnd + 1).join("\n").trim();
	return [before, table, after].filter((chunk) => chunk.length > 0);
}
