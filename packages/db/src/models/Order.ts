import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export const ORDER_STATUSES = ["pending-payment", "confirmed", "packed", "dispatched", "delivered", "cancelled", "refunded", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const DELIVERY_METHODS = ["courier", "pickup"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const PAYMENT_METHODS = ["bank-transfer", "cod", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const PRODUCT_NAME_MAX_LENGTH = 160;
const VARIANT_SUMMARY_MAX_LENGTH = 200;
const RECIPIENT_NAME_MAX_LENGTH = 120;
const PHONE_NUMBER_MAX_LENGTH = 32;
const CITY_MAX_LENGTH = 80;
const AREA_MAX_LENGTH = 120;
const STREET_MAX_LENGTH = 200;
const POSTAL_CODE_MAX_LENGTH = 16;
const NOTE_MAX_LENGTH = 500;
const ORDER_NUMBER_MAX_LENGTH = 32;
const CUSTOMER_NAME_MAX_LENGTH = 160;
const TRACKING_NOTE_MAX_LENGTH = 500;
const DISPATCH_VIDEO_URL_MAX_LENGTH = 1000;
const IDEMPOTENCY_KEY_MAX_LENGTH = 80;

interface OrderItemAttributes {
	/** Mongoose-generated when pushing into the parent doc. */
	_id?: mongoose.Types.ObjectId;
	productId: mongoose.Types.ObjectId;
	variantId: mongoose.Types.ObjectId;
	productName: string;
	variantSummary: string;
	unitPriceRupees: number;
	quantity: number;
	/** Catalog deal locked in at add-to-cart — audit trail even if offer is later removed. */
	appliedOfferId?: mongoose.Types.ObjectId;
	appliedOfferTitle?: string;
	appliedOfferLockedAt?: Date;
}

interface OrderAddressAttributes {
	recipientName: string;
	phoneNumber: string;
	city: string;
	area?: string;
	street?: string;
	postalCode?: string;
}

export interface OrderTimelineEntryAttributes {
	/** Mongoose-generated when pushing into the parent doc. */
	_id?: mongoose.Types.ObjectId;
	status: OrderStatus;
	occurredAt: Date;
	note?: string;
}

interface OrderTotalsAttributes {
	subtotalRupees: number;
	shippingRupees: number;
	discountRupees: number;
	paymentSurchargeRupees: number;
	totalRupees: number;
}

export interface OrderAttributes {
	orderNumber: string;
	customerId: mongoose.Types.ObjectId;
	customerSnapshot: { name: string; phoneNumber: string; city: string };
	status: OrderStatus;
	items: OrderItemAttributes[];
	delivery: DeliveryMethod;
	payment: PaymentMethod;
	address?: OrderAddressAttributes;
	totals: OrderTotalsAttributes;
	timeline: OrderTimelineEntryAttributes[];
	trackingNote?: string;
	dispatchVideoUrl?: string;
	estimatedDeliveryAt?: Date;
	pointsEarned: number;
	pointsRedeemed: number;
	/**
	 * True while this order is holding variant stock (decremented at placement).
	 * Flipped to false when the order is cancelled / refunded / returned and the
	 * stock is returned to the pool — gates release so it can't run twice.
	 */
	inventoryReserved: boolean;
	/**
	 * Client-supplied key that makes placement idempotent: a retried submission
	 * with the same key returns the original order instead of creating a second.
	 */
	idempotencyKey?: string;
	/** PK payment gateway reference (PayFast basket / Rapid payment id). */
	gatewayPaymentRef?: string;
	/** Which gateway handled the online payment. */
	gatewayProvider?: "payfast" | "rapid-gateway";
	/** Array of admin User IDs who have viewed this order. */
	seenByAdminIds: mongoose.Types.ObjectId[];
	placedAt: Date;
}

export type OrderDoc = HydratedDocument<OrderAttributes>;

const orderItemSchema = new Schema<OrderItemAttributes>(
	{
		productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
		variantId: { type: Schema.Types.ObjectId, required: true },
		productName: { type: String, required: true, trim: true, maxlength: PRODUCT_NAME_MAX_LENGTH },
		variantSummary: { type: String, required: true, trim: true, maxlength: VARIANT_SUMMARY_MAX_LENGTH },
		unitPriceRupees: { type: Number, required: true, min: 0 },
		quantity: { type: Number, required: true, min: 1, default: 1 },
		appliedOfferId: { type: Schema.Types.ObjectId, ref: "Offer" },
		appliedOfferTitle: { type: String, trim: true, maxlength: PRODUCT_NAME_MAX_LENGTH },
		appliedOfferLockedAt: { type: Date },
	},
	{ _id: true, timestamps: false },
);

const addressSchema = new Schema<OrderAddressAttributes>(
	{
		recipientName: { type: String, required: true, trim: true, maxlength: RECIPIENT_NAME_MAX_LENGTH },
		phoneNumber: { type: String, required: true, trim: true, maxlength: PHONE_NUMBER_MAX_LENGTH },
		city: { type: String, required: true, trim: true, maxlength: CITY_MAX_LENGTH },
		area: { type: String, trim: true, maxlength: AREA_MAX_LENGTH },
		street: { type: String, trim: true, maxlength: STREET_MAX_LENGTH },
		postalCode: { type: String, trim: true, maxlength: POSTAL_CODE_MAX_LENGTH },
	},
	{ _id: false, timestamps: false },
);

const timelineSchema = new Schema<OrderTimelineEntryAttributes>(
	{
		status: { type: String, enum: ORDER_STATUSES, required: true },
		occurredAt: { type: Date, required: true, default: () => new Date() },
		note: { type: String, trim: true, maxlength: NOTE_MAX_LENGTH },
	},
	{ _id: true, timestamps: false },
);

const totalsSchema = new Schema<OrderTotalsAttributes>(
	{
		subtotalRupees: { type: Number, required: true, min: 0 },
		shippingRupees: { type: Number, required: true, min: 0, default: 0 },
		discountRupees: { type: Number, required: true, min: 0, default: 0 },
		paymentSurchargeRupees: { type: Number, required: true, min: 0, default: 0 },
		totalRupees: { type: Number, required: true, min: 0 },
	},
	{ _id: false, timestamps: false },
);

const orderSchema = new Schema<OrderAttributes>(
	{
		orderNumber: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			maxlength: ORDER_NUMBER_MAX_LENGTH,
			index: true,
		},
		customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
		customerSnapshot: {
			name: { type: String, required: true, trim: true, maxlength: CUSTOMER_NAME_MAX_LENGTH },
			phoneNumber: { type: String, required: true, trim: true, maxlength: PHONE_NUMBER_MAX_LENGTH },
			city: { type: String, required: true, trim: true, maxlength: CITY_MAX_LENGTH },
		},
		status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
		items: { type: [orderItemSchema], required: true },
		delivery: { type: String, enum: DELIVERY_METHODS, required: true },
		payment: { type: String, enum: PAYMENT_METHODS, required: true },
		address: { type: addressSchema },
		totals: { type: totalsSchema, required: true },
		timeline: { type: [timelineSchema], default: [] },
		trackingNote: { type: String, trim: true, maxlength: TRACKING_NOTE_MAX_LENGTH },
		dispatchVideoUrl: { type: String, trim: true, maxlength: DISPATCH_VIDEO_URL_MAX_LENGTH },
		estimatedDeliveryAt: { type: Date },
		pointsEarned: { type: Number, required: true, min: 0, default: 0 },
		pointsRedeemed: { type: Number, required: true, min: 0, default: 0 },
		inventoryReserved: { type: Boolean, required: true, default: false },
		idempotencyKey: { type: String, trim: true, maxlength: IDEMPOTENCY_KEY_MAX_LENGTH },
		gatewayPaymentRef: { type: String, trim: true, maxlength: 200, index: true, sparse: true },
		gatewayProvider: { type: String, enum: ["payfast", "rapid-gateway"], trim: true },
		seenByAdminIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
		placedAt: { type: Date, required: true, default: () => new Date() },
	},
	{ timestamps: true },
);

orderSchema.index({ status: 1, placedAt: -1 });
orderSchema.index({ placedAt: -1 });
// Idempotent placement: a retried submission reuses its key. Sparse so the
// (vast majority of) legacy orders without a key don't collide on `null`.
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
// Backs the referential-integrity check inside DELETE /api/admin/products/[id]
// and any "orders containing product X" lookup the admin reports drive.
orderSchema.index({ "items.productId": 1 });

export const Order: Model<OrderAttributes> = (mongoose.models.Order as Model<OrderAttributes>) ?? mongoose.model<OrderAttributes>("Order", orderSchema);
