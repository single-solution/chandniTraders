/**
 * Derive catalog search terms, budget, and lightweight intents from free-text chat.
 * Used when the LLM path fails so short or vague messages still map to live data.
 */

const CHAT_STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"any",
	"are",
	"available",
	"availability",
	"batao",
	"batayein",
	"bhai",
	"can",
	"chahiye",
	"cost",
	"dikhao",
	"do",
	"for",
	"got",
	"have",
	"hi",
	"hello",
	"hey",
	"how",
	"hai",
	"i",
	"is",
	"ka",
	"ke",
	"ki",
	"kya",
	"live",
	"looking",
	"me",
	"mein",
	"much",
	"mujhe",
	"my",
	"need",
	"please",
	"price",
	"salam",
	"share",
	"show",
	"some",
	"stock",
	"tell",
	"the",
	"want",
	"what",
	"you",
	"your",
]);

const BUDGET_PATTERN =
	/\b(?:under|below|upto|up\s*to|max|maximum|less\s+than|kam|se\s+kam|within)\s*(?:rs\.?|pkr|rupees?)?\s*([\d,.]+)\s*(k|lakh|lac|lacs|l)?\b/i;

const BUDGET_BARE_PATTERN = /\b([\d,.]+)\s*(k|lakh|lac|lacs|l)\b(?:\s*(?:budget|range|tak|tak\s+ka))?\b/i;

const ACCOUNT_PATTERN =
	/\b(my\s+account|account\s+info|loyalty|reward\s+points?|points\s+balance|profile|mera\s+account|points\s+kitne|kitne\s+points)\b/i;

const POPULAR_PATTERN =
	/\b(popular|trending|best\s+sell(?:er|ing)?|hot\s+right\s+now|most\s+bought|recommended|what(?:'?s|\s+is)\s+(?:good|new|latest)|newest|latest\s+arrival|kya\s+chal\s+raha|zyada\s+sell)\b/i;

function parseRupeesAmount(raw: string, suffix?: string): number | undefined {
	const normalized = raw.replace(/,/g, "").trim();
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return undefined;
	}
	let amount = parsed;
	const unit = (suffix ?? "").toLowerCase();
	if (unit === "k") {
		amount *= 1_000;
	} else if (unit === "l" || unit.startsWith("lac")) {
		amount *= 100_000;
	}
	return Math.round(amount);
}

export function isChatStopWord(token: string): boolean {
	return CHAT_STOP_WORDS.has(token.toLowerCase().replace(/[?.!]+$/, ""));
}

/** Max budget in Rs when the customer mentions "under 150k", "1.5 lac", etc. */
export function extractBudgetMaxRupees(message: string): number | undefined {
	const underMatch = message.match(BUDGET_PATTERN);
	if (underMatch?.[1]) {
		return parseRupeesAmount(underMatch[1], underMatch[2]);
	}
	const bareMatch = message.match(BUDGET_BARE_PATTERN);
	if (bareMatch?.[1]) {
		return parseRupeesAmount(bareMatch[1], bareMatch[2]);
	}
	return undefined;
}

/** Search strings to try against the live catalog (full phrase + meaningful tokens). */
export function extractCatalogSearchQueries(message: string): string[] {
	const cleaned = message.trim().replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim();
	if (!cleaned) {
		return [];
	}

	const queries: string[] = [];
	if (cleaned.length >= 2 && cleaned.length <= 80) {
		queries.push(cleaned);
	}

	for (const token of cleaned.split(/[\s,;/]+/)) {
		const word = token.replace(/^[^\w+]+|[^\w+]+$/g, "").trim();
		if (word.length < 2 || isChatStopWord(word)) {
			continue;
		}
		queries.push(word);
	}

	return [...new Set(queries)].slice(0, 6);
}

export function customerAskedAboutAccount(message: string): boolean {
	return ACCOUNT_PATTERN.test(message);
}

export function customerAskedAboutPopular(message: string): boolean {
	return POPULAR_PATTERN.test(message);
}
