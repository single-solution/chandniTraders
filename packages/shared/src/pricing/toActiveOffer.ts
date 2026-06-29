import type { OfferAction, OfferCondition, OfferSchedule } from "./offerTypes";
import type { ActiveOffer } from "./offerEvaluator";

export type OfferDocLike = {
	_id?: { toString(): string } | string;
	id?: string;
	title?: string;
	badgeLabel?: string;
	conditions?: OfferCondition[];
	action?: OfferAction;
	schedule?: OfferSchedule;
	constraints?: {
		isStackable?: boolean;
		allowLoyaltyPoints?: boolean;
		usageLimit?: number;
		usageCount?: number;
	};
};

/** Map a stored offer document to the evaluator's `ActiveOffer` shape. */
export function toActiveOffer(doc: OfferDocLike): ActiveOffer {
	const rawId = doc._id ?? doc.id;
	const id = typeof rawId === "object" && rawId !== null && "toString" in rawId ? rawId.toString() : String(rawId ?? "");

	return {
		id,
		title: doc.title ?? "",
		badgeLabel: doc.badgeLabel?.trim() || undefined,
		conditions: doc.conditions ?? [],
		action: doc.action ?? { type: "percentage_discount", value: 0, target: "cart_total" },
		schedule: doc.schedule ?? {},
		isStackable: doc.constraints?.isStackable ?? false,
		allowLoyaltyPoints: doc.constraints?.allowLoyaltyPoints ?? false,
		usageLimit: doc.constraints?.usageLimit,
		usageCount: doc.constraints?.usageCount ?? 0,
	};
}
