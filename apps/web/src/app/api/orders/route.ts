/**
 * Authenticated storefront order placement.
 *
 * Critical security/UX rules:
 *
 *   - **Never trust client prices.** Every line's `unitPriceRupees` is
 *     re-read from the DB and re-computed server-side. Client-supplied price
 *     hints are ignored.
 *   - **Stock is reserved at placement.** Every line's variant `quantity` is
 *     atomically decremented under a `>= requested` guard (the oversell
 *     guard); the order carries `inventoryReserved: true`. Stock returns to
 *     the pool only when the order is cancelled / refunded / returned.
 *   - **Placement is idempotent.** A client-supplied `idempotencyKey` makes a
 *     retried submission return the original order instead of duplicating it.
 *   - **Customer identity comes from the session.** The client can submit a
 *     display name/address, but never chooses the customer record.
 *   - **Order numbers are unique even under contention.** A retry loop
 *     handles the rare same-second collision.
 *   - **Body & rate limits.** parseBody enforces a fixed body cap;
 *     enforcePublicRateLimit caps placements per signed-in customer within the
 *     short-burst window (see SHORT_BURST_WINDOW_MS).
 *
 * Loyalty points are earned only when the order transitions to `delivered`;
 * redeemed points are debited atomically here at placement, and refunded if
 * order creation fails.
 */

import { type Types } from "mongoose";

import {
	connectDB,
	createWithUniqueOrderNumber,
	Customer,
	decrementOfferUsageCounts,
	incrementOfferUsageCounts,
	isMongoDuplicateKeyError,
	LoyaltyAccount,
	Offer as OfferModel,
	Order as OrderModel,
	Product as ProductModel,
	releaseStock,
	reserveStock,
	getStoreSettings,
	fireOrderEventNotifications,
	getIntegrationSettings,
	type StockLine,
	type CustomerAddressAttributes,
	type CustomerAttributes,
	type DeliveryMethod,
	type OfferAttributes,
	type OrderDoc,
	type OrderStatus,
	type PaymentMethod,
	type ProductAttributes,
	type VariantAttributes,
} from "@store/db";
import {
	FIELD_LIMITS,
	badRequest,
	conflict,
	created,
	evaluateCartOffers,
	isValidId,
	isValidationError,
	logger,
	isVariantInStock,
	LOYALTY_MIN_REDEEM,
	maxRedeemable,
	parseBody,
	pointsEarnedFor,
	pointsToRupees,
	serverError,
	SHORT_BURST_WINDOW_MS,
	unauthorized,
	validateString,
	validateSubmittedCatalogOfferLock,
	computeCodSurchargeRupees,
	computeCourierShippingRupees,
	getPaymentMethods,
	isOfferEligible,
	isOnlineCardCheckoutReady,
	orderPaymentToCheckoutId,
	toActiveOffer,
	type EvaluatableItem,
} from "@store/shared";

import { enforcePublicRateLimit } from "@/lib/api/publicRateLimit";
import { enforceSameOrigin } from "@/lib/api/sameOrigin";
import { findVariantOnProduct } from "@/lib/cart/reconcileCartLines";
import { applyCatalogVisibility, resolveCatalogVisibility } from "@/lib/core/queries";
import { getVerifiedCustomer } from "@/lib/server/customerSession";
import { startOrderOnlineCheckout, toOnlineCheckoutApiResponse } from "@/lib/payments/startOnlineCheckout";

const ALLOWED_DELIVERY: ReadonlyArray<DeliveryMethod> = ["pickup", "courier"];
const ALLOWED_PAYMENT: ReadonlyArray<PaymentMethod> = ["bank-transfer", "cod", "card"];

const isDeliveryMethod = (value: unknown): value is DeliveryMethod => typeof value === "string" && (ALLOWED_DELIVERY as readonly string[]).includes(value);
const isPaymentMethod = (value: unknown): value is PaymentMethod => typeof value === "string" && (ALLOWED_PAYMENT as readonly string[]).includes(value);

const MAX_LINES_PER_ORDER = 20;
/** Inclusive minimum quantity per cart line — anything below is a bad-request. */
const MIN_QUANTITY_PER_LINE = 1;
const MAX_QUANTITY_PER_LINE = 10;
/** Max order placements per IP+phone per `SHORT_BURST_WINDOW_MS`. */
const MAX_ORDERS_PER_WINDOW = 5;

/** Inclusive minimum length for the customer's full name on checkout. */
const MIN_NAME_CHARS = 2;
/** Inclusive minimum length for a customer phone number — short enough to
 *  accept landline-style sequences while rejecting obvious typos. */
const MIN_PHONE_CHARS = 7;
const DEFAULT_CUSTOMER_CITY = "—";

interface OrderItemBody {
	productId?: unknown;
	variantId?: unknown;
	quantity?: unknown;
	attributes?: unknown;
	appliedOfferId?: unknown;
	appliedOfferLockedAt?: unknown;
}

interface AddressBody {
	recipientName?: unknown;
	area?: unknown;
	street?: unknown;
	postalCode?: unknown;
}

interface CustomerBody {
	name?: unknown;
}

interface OrderBody {
	customer?: CustomerBody;
	items?: unknown;
	delivery?: unknown;
	payment?: unknown;
	address?: AddressBody;
	loyalty?: {
		redeemPoints?: unknown;
	};
	idempotencyKey?: unknown;
}

/** Max length we accept for a client-supplied idempotency key. */
const MAX_IDEMPOTENCY_KEY_CHARS = 80;

interface ResolvedItem {
	productDoc: ProductAttributes & { _id: Types.ObjectId };
	variant: VariantAttributes & { _id: Types.ObjectId };
	quantity: number;
	appliedOfferId?: string;
	appliedOfferTitle?: string;
	appliedOfferLockedAt?: Date;
}

export async function POST(request: Request) {
	const csrf = enforceSameOrigin(request);
	if (csrf) {
		return csrf;
	}

	const actor = await getVerifiedCustomer();
	if (!actor) {
		return unauthorized();
	}

	const parsed = await parseBody<OrderBody>(request);
	if (parsed instanceof Response) {
		return parsed;
	}
	const body = parsed;

	const limited = enforcePublicRateLimit(request, {
		scope: "storefront-order",
		identifier: actor.phoneNumber ?? actor.id,
		max: MAX_ORDERS_PER_WINDOW,
		windowMs: SHORT_BURST_WINDOW_MS,
	});
	if (limited) {
		return limited;
	}

	if (!isDeliveryMethod(body.delivery)) {
		return badRequest(`delivery must be one of: ${ALLOWED_DELIVERY.join(", ")}.`);
	}
	const delivery = body.delivery;
	if (!isPaymentMethod(body.payment)) {
		return badRequest(`payment must be one of: ${ALLOWED_PAYMENT.join(", ")}.`);
	}
	const payment = body.payment;

	if (payment === "card") {
		const integration = await getIntegrationSettings();
		if (!isOnlineCardCheckoutReady(integration)) {
			return badRequest("Online payment is not available right now. Choose bank transfer or cash on delivery.");
		}
	}

	const items = body.items;

	// Items: at least one, at most MAX_LINES_PER_ORDER.
	if (!Array.isArray(items) || items.length === 0) {
		return badRequest("Cart cannot be empty.");
	}
	if (items.length > MAX_LINES_PER_ORDER) {
		return badRequest(`Cart cannot contain more than ${MAX_LINES_PER_ORDER} lines.`);
	}

	const idempotencyKey =
		typeof body.idempotencyKey === "string" && body.idempotencyKey.trim().length > 0 ? body.idempotencyKey.trim().slice(0, MAX_IDEMPOTENCY_KEY_CHARS) : undefined;

	if (!idempotencyKey) {
		return badRequest("Missing idempotency key. Refresh checkout and try again.");
	}

	await connectDB();

	// Idempotency: a retried submission (double-click, flaky network, second
	// tab) reuses its key — return the original order instead of placing a new
	// one. The unique index closes the simultaneous-request race at create time.
	if (idempotencyKey) {
		const priorOrder = await OrderModel.findOne({
			idempotencyKey,
			customerId: actor.id,
		}).lean<{
			_id: Types.ObjectId;
			orderNumber: string;
			payment: PaymentMethod;
			status: OrderStatus;
			totals: { totalRupees: number };
			pointsEarned: number;
			pointsRedeemed: number;
		}>();
		if (priorOrder) {
			const base = {
				id: priorOrder._id.toString(),
				orderNumber: priorOrder.orderNumber,
				totalRupees: priorOrder.totals.totalRupees,
				pointsEarned: priorOrder.pointsEarned,
				pointsRedeemed: priorOrder.pointsRedeemed,
			};
			if (priorOrder.payment === "card" && priorOrder.status === "pending-payment") {
				const orderDoc = await OrderModel.findById(priorOrder._id);
				if (orderDoc) {
					try {
						const [integration, storeSettings] = await Promise.all([getIntegrationSettings(), getStoreSettings()]);
						const checkout = await startOrderOnlineCheckout({
							order: orderDoc,
							integration,
							storeName: storeSettings.siteName,
							publicSiteUrl: storeSettings.publicSiteUrl,
						});
						return created({ ...base, ...toOnlineCheckoutApiResponse(checkout) });
					} catch {
						return created(base);
					}
				}
			}
			return created(base);
		}
	}

	const existingCustomer = await Customer.findById(actor.id).lean<CustomerAttributes & { _id: Types.ObjectId }>();
	if (!existingCustomer) {
		return unauthorized();
	}

	const customerNameInput = typeof body.customer?.name === "string" && body.customer.name.trim().length > 0 ? body.customer.name : existingCustomer.name;
	const nameResult = validateString(customerNameInput, {
		label: "Name",
		min: MIN_NAME_CHARS,
		max: FIELD_LIMITS.personName,
	});
	if (isValidationError(nameResult)) {
		return badRequest(nameResult.error);
	}

	const phoneResult = validateString(existingCustomer.phoneNumber, {
		label: "Phone",
		min: MIN_PHONE_CHARS,
		max: FIELD_LIMITS.phoneNumber,
	});
	if (isValidationError(phoneResult)) {
		return badRequest(phoneResult.error);
	}

	const cityResult = resolveCustomerCity(existingCustomer.city);

	// Address required for courier deliveries — we never ship without one.
	let addressInput: ResolvedAddress | undefined;
	if (delivery === "courier") {
		addressInput = parseAddress(body.address, {
			fallbackName: nameResult,
			fallbackPhone: phoneResult,
			fallbackCity: cityResult,
		});
		if ("error" in addressInput) {
			return badRequest(addressInput.error);
		}
	}

	// Validate each cart line and collect IDs in one pass so we can run a
	// single `find($in)` round-trip below instead of N per-line queries.
	interface ValidatedLine {
		productId: string;
		variantId: string;
		quantity: number;
		attributes: Record<string, string | string[]>;
		appliedOfferId?: string;
		appliedOfferLockedAt?: Date;
	}
	const productIds = new Set<string>();
	// Merge by product+variant so the same variant sent across two lines is
	// validated (and reserved) against one combined quantity — otherwise two
	// qty-1 lines could each pass a "1 in stock" check and oversell.
	const mergedLines = new Map<string, ValidatedLine>();
	for (const raw of items) {
		// `items` was confirmed to be an array above; each element still
		// arrives as a freshly-parsed JSON value, so we type it through the
		// all-`unknown` `OrderItemBody` shape and validate every field below.
		const line = raw as OrderItemBody;
		if (!isValidId(line.productId)) {
			return badRequest("Each item must include a valid productId.");
		}
		if (!isValidId(line.variantId)) {
			return badRequest("Each item must include a valid variantId.");
		}
		const quantity = typeof line.quantity === "number" ? line.quantity : Number(line.quantity);
		if (!Number.isFinite(quantity) || quantity < MIN_QUANTITY_PER_LINE) {
			return badRequest(`Item quantity must be at least ${MIN_QUANTITY_PER_LINE}.`);
		}
		const key = `${line.productId}:${line.variantId}`;
		const existing = mergedLines.get(key);
		const combined = (existing?.quantity ?? 0) + Math.floor(quantity);
		if (combined > MAX_QUANTITY_PER_LINE) {
			return badRequest(`Quantity per line cannot exceed ${MAX_QUANTITY_PER_LINE}.`);
		}
		const appliedOfferId = typeof line.appliedOfferId === "string" && isValidId(line.appliedOfferId) ? line.appliedOfferId : existing?.appliedOfferId;
		let appliedOfferLockedAt: Date | undefined = existing?.appliedOfferLockedAt;
		if (typeof line.appliedOfferLockedAt === "string" && line.appliedOfferLockedAt.trim().length > 0) {
			const parsedLock = new Date(line.appliedOfferLockedAt);
			if (!Number.isNaN(parsedLock.getTime())) {
				appliedOfferLockedAt = parsedLock;
			}
		}
		const attributes =
			line.attributes && typeof line.attributes === "object" && !Array.isArray(line.attributes)
				? (line.attributes as Record<string, string | string[]>)
				: (existing?.attributes ?? {});
		productIds.add(line.productId);
		mergedLines.set(key, {
			productId: line.productId,
			variantId: line.variantId,
			quantity: combined,
			attributes,
			appliedOfferId,
			appliedOfferLockedAt,
		});
	}
	const validatedLines: ValidatedLine[] = Array.from(mergedLines.values());
	const productFilter: Record<string, unknown> = {
		_id: { $in: Array.from(productIds) },
		isActive: true,
		isArchived: { $ne: true },
	};
	applyCatalogVisibility(productFilter, await resolveCatalogVisibility());
	const products = await ProductModel.find(productFilter).lean<(ProductAttributes & { _id: Types.ObjectId })[]>();
	const productMap = new Map(products.map((doc) => [doc._id.toString(), doc]));

	const resolvedItems: ResolvedItem[] = [];
	for (const line of validatedLines) {
		const product = productMap.get(line.productId);
		if (!product) {
			return conflict("One or more products in your cart are no longer available. Remove them and add fresh items from the shop.");
		}
		const variant =
			product.variants.find((candidate) => candidate._id?.toString() === line.variantId) ??
			findVariantOnProduct(product, {
				variantId: line.variantId,
				attributes: line.attributes,
			});
		if (!variant) {
			return conflict(
				`${product.name} in your cart is out of date. Remove it from your cart, open the product page again, and add it back before placing your order.`,
			);
		}
		if (
			!isVariantInStock({
				quantity: variant.quantity,
				forceOutOfStock: variant.forceOutOfStock === true,
			})
		) {
			return conflict(`${product.name} is sold out.`);
		}
		if (variant.quantity < line.quantity) {
			return conflict(`${product.name} has only ${variant.quantity} in stock.`);
		}
		// Mongoose's `lean()` returns embedded subdocs without `_id` typed as
		// ObjectId; the variant just came back from the same query as the parent
		// doc, so the cast is structurally a no-op.
		resolvedItems.push({
			productDoc: product,
			variant: variant as VariantAttributes & { _id: Types.ObjectId },
			quantity: line.quantity,
			appliedOfferId: line.appliedOfferId,
			appliedOfferLockedAt: line.appliedOfferLockedAt,
		});
	}

	// Totals — server-authoritative. Discount % and free-delivery threshold are
	// resolved from `StoreSettings` so the admin can change them without a deploy.
	const settings = await getStoreSettings();
	const checkoutPaymentId = orderPaymentToCheckoutId(payment);
	if (!checkoutPaymentId || !getPaymentMethods(settings).some((method) => method.id === checkoutPaymentId)) {
		return badRequest("This payment method is not available right now.");
	}
	const subtotalRupees = resolvedItems.reduce((sum, line) => sum + line.variant.priceRupees * line.quantity, 0);

	// Promotional offers — server-authoritative. The client computes the same
	// numbers for display, but the discount that actually bills the customer is
	// re-evaluated here from live offer documents so a tampered cart can't claim
	// a discount that doesn't apply. Schedule/usage-limit gating happens inside
	// `evaluateOffers`.
	const evaluatableItems: EvaluatableItem[] = resolvedItems.map((line) => ({
		id: `${line.productDoc._id.toString()}:${line.variant._id.toString()}`,
		productId: line.productDoc._id.toString(),
		variantId: line.variant._id.toString(),
		categorySlug: line.productDoc.categorySlug,
		brandSlug: line.productDoc.brandSlug,
		price: line.variant.priceRupees,
		quantity: line.quantity,
		attributes: line.variant.attributes ?? {},
	}));
	const lineOfferIds = Object.fromEntries(resolvedItems.filter((line) => line.appliedOfferId).map((line) => [`${line.productDoc._id.toString()}:${line.variant._id.toString()}`, line.appliedOfferId]));

	const lockedOfferIds = Array.from(new Set(resolvedItems.map((line) => line.appliedOfferId).filter((offerId): offerId is string => Boolean(offerId))));
	const lockedOfferDocs =
		lockedOfferIds.length > 0
			? await OfferModel.find({ _id: { $in: lockedOfferIds }, isActive: true }).lean<(OfferAttributes & { _id: Types.ObjectId })[]>()
			: [];
	if (lockedOfferIds.length !== lockedOfferDocs.length) {
		return badRequest("One or more applied offers are invalid.");
	}
	const lockedCatalogOffers = lockedOfferDocs.map(toActiveOffer).filter((offer) => isOfferEligible(offer));
	const lockedOfferById = new Map(lockedCatalogOffers.map((offer) => [offer.id, offer]));

	for (const line of resolvedItems) {
		if (!line.appliedOfferId) {
			continue;
		}
		const item = evaluatableItems.find((entry) => entry.id === `${line.productDoc._id.toString()}:${line.variant._id.toString()}`);
		if (!item) {
			return badRequest("Could not validate applied offer for a cart line.");
		}
		const offer = lockedOfferById.get(line.appliedOfferId);
		const validationError = validateSubmittedCatalogOfferLock(line.appliedOfferId, item, offer, {
			cartTotal: item.price * item.quantity,
		});
		if (validationError) {
			return badRequest(validationError);
		}
		line.appliedOfferTitle = offer?.title;
	}

	const offerDocs = await OfferModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean<(OfferAttributes & { _id: Types.ObjectId })[]>();
	const offerPricing = evaluateCartOffers(evaluatableItems, offerDocs.map(toActiveOffer), {
		paymentMethod: orderPaymentToCheckoutId(payment),
		lineOfferIds,
		lockedCatalogOffers,
	});
	const offerDiscountRupees = Math.round(offerPricing.totalDiscount);
	if (offerDiscountRupees > subtotalRupees) {
		return badRequest("Invalid offer discount for this cart.");
	}

	for (const line of resolvedItems) {
		if (line.appliedOfferId && !offerPricing.appliedOfferIds.includes(line.appliedOfferId)) {
			return badRequest("One or more applied offers could not be honored on this order.");
		}
	}

	const subtotalAfterOffersRupees = subtotalRupees - offerDiscountRupees;
	const paymentSurchargeRupees =
		payment === "cod" ? computeCodSurchargeRupees(subtotalAfterOffersRupees, settings.codSurchargePercent) : 0;
	const discountRupees = offerDiscountRupees;
	const shippingRupees = computeCourierShippingRupees({
		isCourierDelivery: delivery === "courier",
		subtotalAfterOffersRupees,
		freeDeliveryThresholdRupees: settings.freeDeliveryThresholdRupees,
		courierFlatFeeRupees: settings.courierFlatFeeRupees,
		offerGrantsFreeShipping: offerPricing.freeShipping,
	});
	const requestedRedeemPoints = Number(body.loyalty?.redeemPoints ?? 0);
	if (!Number.isFinite(requestedRedeemPoints) || requestedRedeemPoints < 0) {
		return badRequest("Redeemed points must be a positive number.");
	}
	const loyaltyAccount = requestedRedeemPoints > 0 ? await LoyaltyAccount.findOne({ customerId: existingCustomer._id }) : null;
	if (requestedRedeemPoints > 0 && !loyaltyAccount) {
		return badRequest("No loyalty balance is available for this customer.");
	}
	const pointsRedeemed = requestedRedeemPoints ? Math.floor(requestedRedeemPoints) : 0;
	if (pointsRedeemed > 0 && pointsRedeemed < LOYALTY_MIN_REDEEM) {
		return badRequest(`Redeem at least ${LOYALTY_MIN_REDEEM} points or leave redemption off.`);
	}
	if (pointsRedeemed > 0 && !offerPricing.isLoyaltyPointsAllowed) {
		return badRequest("Loyalty points can't be combined with the current offers.");
	}
	const maxRedeemablePoints = loyaltyAccount ? maxRedeemable(subtotalAfterOffersRupees, loyaltyAccount.balance) : 0;
	if (pointsRedeemed > maxRedeemablePoints) {
		return badRequest(`You can redeem up to ${maxRedeemablePoints} points on this order.`);
	}
	const pointsRedeemedRupees = pointsToRupees(pointsRedeemed);
	const totalRupees = Math.max(0, subtotalAfterOffersRupees + shippingRupees + paymentSurchargeRupees - pointsRedeemedRupees);

	const nextAddresses = addressInput && "value" in addressInput ? mergeCheckoutAddress(existingCustomer.addresses ?? [], addressInput.value) : (existingCustomer.addresses ?? []);

	// Reserve stock up front — this is the oversell guard. `reserveStock` rolls
	// its own partial reservations back, so a failure leaves inventory untouched.
	const stockLines: StockLine[] = resolvedItems.map((line) => ({
		productId: line.productDoc._id,
		variantId: line.variant._id,
		quantity: line.quantity,
	}));

	let createdOrder: OrderDoc | null = null;
	let reservation: { ok: boolean } | null = null;
	let customerDoc: { _id: Types.ObjectId; isLoyaltyMember: boolean } | null = null;
	let offerUsageReserved = false;
	const reservedOfferIds = offerPricing.appliedOfferIds;
	try {
		customerDoc = await Customer.findByIdAndUpdate(
			existingCustomer._id,
			{
				name: nameResult,
				city: cityResult,
				isLoyaltyMember: true,
				...(addressInput && "value" in addressInput ? { addresses: nextAddresses } : {}),
			},
			{ new: true, runValidators: true },
		).lean<{ _id: Types.ObjectId; isLoyaltyMember: boolean }>();

		if (!customerDoc) {
			logger.error("Customer upsert returned null — cannot continue");
			return badRequest("Could not place order.");
		}

		// Earn on the payable order total (merchandise after offers + fees − redemption).
		const pointsEarned = pointsEarnedFor(totalRupees, settings.loyaltyEarnPercent);

		reservation = await reserveStock(stockLines);
		if (!reservation.ok) {
			return conflict("Some items just sold out. Please review your cart and try again.");
		}

		if (reservedOfferIds.length > 0) {
			const usageOk = await incrementOfferUsageCounts(reservedOfferIds);
			if (!usageOk) {
				await releaseStock(stockLines);
				return conflict("One or more offers are no longer available. Refresh your cart and try again.");
			}
			offerUsageReserved = true;
		}

		// COD is confirmed on placement — customer pays cash on delivery.
		// Bank transfer and card stay pending until admin confirms or gateway pays.
		const initialStatus: OrderStatus = payment === "cod" ? "confirmed" : "pending-payment";
		const placedAt = new Date();
		const placementNote =
			payment === "cod"
				? "Cash on delivery order placed."
				: payment === "bank-transfer"
					? "Order placed — transfer payment and send screenshot on WhatsApp."
					: "Order placed — complete online payment.";

		createdOrder = await createWithUniqueOrderNumber<OrderDoc>((orderNumber) =>
			OrderModel.create({
				orderNumber,
				customerId: customerDoc!._id,
				customerSnapshot: {
					name: nameResult,
					phoneNumber: phoneResult,
					city: cityResult,
				},
				status: initialStatus,
				items: resolvedItems.map((line) => ({
					productId: line.productDoc._id,
					variantId: line.variant._id,
					productName: line.productDoc.name,
					variantSummary: buildVariantSummary(line.variant),
					unitPriceRupees: line.variant.priceRupees,
					quantity: line.quantity,
					...(line.appliedOfferId
						? {
								appliedOfferId: line.appliedOfferId,
								appliedOfferTitle: line.appliedOfferTitle,
								appliedOfferLockedAt: line.appliedOfferLockedAt ?? new Date(),
							}
						: {}),
				})),
				delivery,
				payment,
				address: addressInput && "value" in addressInput ? addressInput.value : undefined,
				totals: {
					subtotalRupees,
					shippingRupees,
					discountRupees,
					paymentSurchargeRupees,
					totalRupees,
				},
				timeline: [
					payment === "cod"
						? {
								status: "confirmed",
								occurredAt: placedAt,
								note: placementNote,
							}
						: {
								status: "pending-payment",
								occurredAt: placedAt,
								note: placementNote,
							},
				],
				pointsEarned,
				pointsRedeemed,
				inventoryReserved: true,
				idempotencyKey,
				placedAt,
			}),
		);

		// Debit redeemed points atomically — the `balance >= pointsRedeemed` guard
		// prevents two concurrent checkouts from overspending the same balance.
		if (pointsRedeemed > 0) {
			const debited = await LoyaltyAccount.findOneAndUpdate(
				{ customerId: customerDoc!._id, balance: { $gte: pointsRedeemed } },
				{
					$inc: { balance: -pointsRedeemed },
					$push: {
						transactions: {
							kind: "redeem",
							amount: pointsRedeemed,
							occurredAt: new Date(),
							reason: "Redeemed during storefront checkout.",
							orderRef: createdOrder.orderNumber,
						},
					},
				},
			);
			if (!debited) {
				await createdOrder.deleteOne();
				await releaseStock(stockLines);
				return conflict("Your loyalty balance changed. Please review your points and try again.");
			}
		}

		const placedOrderNumber = createdOrder.orderNumber;
		void fireOrderEventNotifications({
			event: "placed",
			order: createdOrder,
			nextStatus: initialStatus,
		}).catch((error: unknown) => {
			logger.warn({ error, orderNumber: placedOrderNumber }, "Order notifications failed");
		});

		if (payment === "card") {
			const integration = await getIntegrationSettings();
			try {
				const checkout = await startOrderOnlineCheckout({
					order: createdOrder,
					integration,
					storeName: settings.siteName,
					publicSiteUrl: settings.publicSiteUrl,
				});
				return created({
					id: createdOrder._id.toString(),
					orderNumber: createdOrder.orderNumber,
					totalRupees,
					pointsEarned,
					pointsRedeemed,
					...toOnlineCheckoutApiResponse(checkout),
				});
			} catch (gatewayError) {
				logger.error({ error: gatewayError, orderNumber: createdOrder.orderNumber }, "Online checkout session failed");
				await createdOrder.deleteOne().catch(() => undefined);
				if (pointsRedeemed > 0) {
					await LoyaltyAccount.findOneAndUpdate(
						{ customerId: customerDoc!._id },
						{
							$inc: { balance: pointsRedeemed },
							$push: {
								transactions: {
									kind: "adjust",
									amount: pointsRedeemed,
									occurredAt: new Date(),
									reason: "Checkout payment setup failed — points restored.",
									orderRef: createdOrder.orderNumber,
								},
							},
						},
					).catch(() => undefined);
				}
				await releaseStock(stockLines);
				if (offerUsageReserved) {
					await decrementOfferUsageCounts(reservedOfferIds).catch(() => undefined);
				}
				return serverError("Could not start card payment. Please try again or choose bank transfer or cash on delivery.");
			}
		}

		return created({
			id: createdOrder._id.toString(),
			orderNumber: createdOrder.orderNumber,
			totalRupees,
			pointsEarned,
			pointsRedeemed,
		});
	} catch (error) {
		// Unwind everything this attempt did so a failure never leaves stock held
		// or a half-created order behind.
		if (createdOrder) {
			await createdOrder.deleteOne().catch(() => undefined);
		}
		if (reservation?.ok) {
			await releaseStock(stockLines);
		}
		if (offerUsageReserved) {
			await decrementOfferUsageCounts(reservedOfferIds).catch(() => undefined);
		}
		if (pointsRedeemed > 0 && customerDoc) {
			await LoyaltyAccount.findOneAndUpdate(
				{ customerId: customerDoc._id },
				{
					$inc: { balance: pointsRedeemed },
					$push: {
						transactions: {
							kind: "adjust",
							amount: pointsRedeemed,
							occurredAt: new Date(),
							reason: "Order placement failed — points restored.",
							orderRef: createdOrder?.orderNumber,
						},
					},
				},
			).catch(() => undefined);
		}

		// A duplicate idempotency key means a parallel submission won the race —
		// return that order instead of surfacing an error.
		if (isMongoDuplicateKeyError(error) && idempotencyKey) {
			const winner = await OrderModel.findOne({
				idempotencyKey,
				customerId: customerDoc?._id ?? existingCustomer._id,
			}).lean<{ _id: Types.ObjectId; orderNumber: string; totals: { totalRupees: number }; pointsEarned: number; pointsRedeemed: number }>();
			if (winner) {
				return created({
					id: winner._id.toString(),
					orderNumber: winner.orderNumber,
					totalRupees: winner.totals.totalRupees,
					pointsEarned: winner.pointsEarned,
					pointsRedeemed: winner.pointsRedeemed,
				});
			}
		}

		logger.error({ error }, "Failed to create storefront order");
		return serverError("Could not place order. Please try again.");
	}
}

interface ResolvedAddressOk {
	value: {
		recipientName: string;
		phoneNumber: string;
		city: string;
		area?: string;
		street?: string;
		postalCode?: string;
	};
}
interface ResolvedAddressError {
	error: string;
}
type ResolvedAddress = ResolvedAddressOk | ResolvedAddressError;

interface AddressFallbacks {
	fallbackName: string;
	fallbackPhone: string;
	fallbackCity: string;
}

function parseAddress(input: AddressBody | undefined, fallbacks: AddressFallbacks): ResolvedAddress {
	if (!input) {
		return { error: "Delivery address is required for courier orders." };
	}
	const recipient = validateString(input.recipientName || fallbacks.fallbackName, {
		label: "Recipient name",
		min: 2,
		max: FIELD_LIMITS.recipientName,
	});
	if (isValidationError(recipient)) {
		return { error: recipient.error };
	}

	let area: string | undefined;
	if (typeof input.area === "string" && input.area.trim().length > 0) {
		const result = validateString(input.area, {
			label: "Area",
			max: FIELD_LIMITS.addressArea,
			required: false,
		});
		if (isValidationError(result)) {
			return { error: result.error };
		}
		area = result;
	}
	let street: string | undefined;
	if (typeof input.street === "string" && input.street.trim().length > 0) {
		const result = validateString(input.street, {
			label: "Street",
			max: FIELD_LIMITS.addressStreet,
			required: false,
		});
		if (isValidationError(result)) {
			return { error: result.error };
		}
		street = result;
	}
	let postalCode: string | undefined;
	if (typeof input.postalCode === "string" && input.postalCode.trim().length > 0) {
		const result = validateString(input.postalCode, {
			label: "Postal code",
			max: FIELD_LIMITS.postalCode,
			required: false,
		});
		if (isValidationError(result)) {
			return { error: result.error };
		}
		postalCode = result;
	}

	if (!street || street.length < 2) {
		return { error: "Street address is required for courier delivery (at least 2 characters)." };
	}

	return {
		value: {
			recipientName: recipient,
			phoneNumber: fallbacks.fallbackPhone,
			city: fallbacks.fallbackCity,
			area,
			street,
			postalCode,
		},
	};
}

function resolveCustomerCity(city: string | undefined): string {
	const trimmed = city?.trim();
	if (!trimmed || trimmed === "—") {
		return DEFAULT_CUSTOMER_CITY;
	}
	return trimmed.slice(0, FIELD_LIMITS.city);
}

function mergeCheckoutAddress(addresses: CustomerAddressAttributes[], checkoutAddress: ResolvedAddressOk["value"]): CustomerAddressAttributes[] {
	const nextAddress: CustomerAddressAttributes = {
		...checkoutAddress,
		label: "Checkout",
		isDefault: true,
	};
	if (addresses.length === 0) {
		return [nextAddress];
	}
	const defaultIndex = addresses.findIndex((address) => address.isDefault);
	const replaceIndex = defaultIndex >= 0 ? defaultIndex : 0;
	return addresses.map((address, index) =>
		index === replaceIndex
			? nextAddress
			: {
					...address,
					isDefault: false,
				},
	);
}

/**
 * Build a human-readable variant summary for the order item — admins read
 * this in the admin order list, customers see it on their receipt.
 * Variant differentiators come from the admin-defined `attributes` map.
 */

function buildVariantSummary(variant: VariantAttributes): string {
	const parts: string[] = [];
	const attributes = variant.attributes ?? {};
	for (const value of Object.values(attributes)) {
		if (typeof value === "string" && value.trim().length > 0) {
			parts.push(value);
		}
	}
	return parts.join(" · ").slice(0, FIELD_LIMITS.shortText);
}

function humaniseSlug(slug: string): string {
	if (!slug) {
		return slug;
	}
	return slug
		.split("-")
		.map((segment) => (segment.length === 0 ? segment : segment[0].toUpperCase() + segment.slice(1)))
		.join(" ");
}

