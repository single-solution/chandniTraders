export interface OfferCondition {
	type: "products" | "categories" | "brands" | "attributes" | "price_range" | "cart_total" | "min_quantity" | "payment_method" | "group";
	operator: "in" | "not_in" | "between" | "gte" | "lte" | "and" | "or";
	value: unknown;
}

export interface OfferAction {
	type: "percentage_discount" | "fixed_amount_discount" | "buy_x_get_y" | "free_shipping";
	value: number;
	target: "matched_items" | "cart_total";
}

export interface OfferSchedule {
	startDate?: Date;
	endDate?: Date;
	daysOfWeek?: number[];
	startTime?: string;
	endTime?: string;
}

export interface OfferConstraints {
	allowLoyaltyPoints: boolean;
	isStackable: boolean;
	usageLimit?: number;
	usageCount: number;
}
