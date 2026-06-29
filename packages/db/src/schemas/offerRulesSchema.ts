import { Schema } from "mongoose";
import type { OfferCondition, OfferAction, OfferSchedule, OfferConstraints } from "@store/shared";

export const offerConditionSchema = new Schema<OfferCondition>(
	{
		type: {
			type: String,
			required: true,
			enum: ["products", "categories", "brands", "attributes", "price_range", "cart_total", "min_quantity", "payment_method", "group"],
		},
		operator: {
			type: String,
			required: true,
			enum: ["in", "not_in", "between", "gte", "lte", "and", "or"],
		},
		value: { type: Schema.Types.Mixed, required: true },
	},
	{ _id: false },
);

export const offerActionSchema = new Schema<OfferAction>(
	{
		type: {
			type: String,
			required: true,
			enum: ["percentage_discount", "fixed_amount_discount", "buy_x_get_y", "free_shipping"],
		},
		value: { type: Number, required: true },
		target: {
			type: String,
			required: true,
			enum: ["matched_items", "cart_total"],
		},
	},
	{ _id: false },
);

export const offerScheduleSchema = new Schema<OfferSchedule>(
	{
		startDate: { type: Date },
		endDate: { type: Date },
		daysOfWeek: { type: [Number], default: undefined },
		startTime: { type: String },
		endTime: { type: String },
	},
	{ _id: false },
);

export const offerConstraintsSchema = new Schema<OfferConstraints>(
	{
		allowLoyaltyPoints: { type: Boolean, required: true, default: false },
		isStackable: { type: Boolean, required: true, default: false },
		usageLimit: { type: Number },
		usageCount: { type: Number, required: true, default: 0 },
	},
	{ _id: false },
);
