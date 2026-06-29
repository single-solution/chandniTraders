import { requireSession } from "@/lib/api/requireSession";
import { hasPermission } from "@/lib/permissions";
import { badRequest, conflict, FIELD_LIMITS, forbidden, isValidId, noContent, notFound, ok, parseBody } from "@store/shared";
import { applyOrderTransition, claimOrderStatusTransition, connectDB, fireOrderEventNotifications, getStoreSettings, handleMongoError, Order, ORDER_STATUSES, Product, releaseStock, reserveStock, type DeliveryMethod, type OrderStatus, type PaymentMethod } from "@store/db";

import { bustAdminCaches } from "@/lib/cached";
import { recordActivity } from "@/lib/services/activityLog";
import { toOrderResponse, type OrderLean } from "@/lib/serializers/order";
import { pointsToRupees } from "@store/shared";

const ALLOWED_STATUSES = new Set<string>(ORDER_STATUSES);
const FULFILLMENT_PATH: OrderStatus[] = ["pending-payment", "confirmed", "packed", "dispatched", "delivered"];

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { response } = await requireSession("order_view");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	const doc = await Order.findById(id).lean<OrderLean>();
	if (!doc) {
		return notFound("Order not found");
	}

	const order = toOrderResponse(doc);
	if (doc.payment === "bank-transfer" && doc.status === "pending-payment") {
		const store = await getStoreSettings();
		return ok({
			...order,
			bankTransferDetails: {
				bankName: store.bankName,
				bankAccountTitle: store.bankAccountTitle,
				bankAccountNumber: store.bankAccountNumber,
				bankIban: store.bankIban,
			},
		});
	}

	return ok(order);
}

interface OrderUpdateInput {
	status?: unknown;
	trackingNote?: unknown;
	dispatchVideoUrl?: unknown;
	estimatedDeliveryAt?: unknown;
	timelineNote?: unknown;
	items?: { productId: string; variantId: string; productName: string; variantSummary: string; unitPriceRupees: number; quantity: number }[];
	address?: { recipientName: string; phoneNumber: string; city: string; area?: string; street?: string; postalCode?: string };
	payment?: unknown;
	delivery?: unknown;
}

export async function PUT(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("order_update");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	const body = await parseBody<OrderUpdateInput>(request);
	if (body instanceof Response) {
		return body;
	}

	await connectDB();
	try {
		const order = await Order.findById(id);
		if (!order) {
			return notFound("Order not found");
		}

		const HAPPY_PATH = FULFILLMENT_PATH;
		const DISPATCHED_INDEX = 3;

		const currentStatusIndex = HAPPY_PATH.indexOf(order.status);

		const isAttemptingEdit = Boolean(body.items || body.address || body.payment || body.delivery);
		if (isAttemptingEdit && order.status !== "pending-payment") {
			return badRequest("Order details cannot be edited once confirmed.");
		}

		const detailParts: string[] = [];
		const previousStatus = order.status;
		let nextStatus: OrderStatus | null = null;

		if (typeof body.status === "string") {
			if (!ALLOWED_STATUSES.has(body.status)) {
				return badRequest(`Status must be one of: ${ORDER_STATUSES.join(", ")}`);
			}
			const candidate = body.status as OrderStatus;

			if (FULFILLMENT_PATH.includes(candidate)) {
				const newStatusIndex = FULFILLMENT_PATH.indexOf(candidate);
				if (currentStatusIndex === -1) {
					return badRequest("A closed order cannot re-enter the fulfillment path.");
				}
				if (newStatusIndex > currentStatusIndex + 1) {
					return badRequest("Fulfillment status can only move forward one step at a time.");
				}
			}

			if (candidate === "returned" && order.status !== "delivered") {
				return badRequest("Only delivered orders can be marked returned.");
			}

			const newStatusIndex = HAPPY_PATH.indexOf(candidate);
			if (currentStatusIndex >= DISPATCHED_INDEX && newStatusIndex !== -1 && newStatusIndex < currentStatusIndex) {
				return badRequest("Status cannot be moved backward once dispatched.");
			}

			if (candidate === "packed") {
				const video = typeof body.dispatchVideoUrl === "string" ? body.dispatchVideoUrl.trim() : order.dispatchVideoUrl;
				if (!video) {
					return badRequest("Dispatch video URL is required when order is packed.");
				}
			}

			if (order.status !== candidate) {
				if (candidate === "cancelled" && !hasPermission(actor, "order_cancel")) {
					return forbidden("You do not have permission to cancel orders.");
				}
				if (candidate === "refunded" && !hasPermission(actor, "order_refund")) {
					return forbidden("You do not have permission to refund orders.");
				}
				nextStatus = candidate;
				detailParts.push(`Status → ${previousStatus} to ${candidate}`);
			}
		}
		if (typeof body.trackingNote === "string") {
			order.trackingNote = body.trackingNote.trim().slice(0, FIELD_LIMITS.operatorNote);
			detailParts.push("Tracking note updated");
		}
		const DISPATCH_VIDEO_URL_MAX = 1000;
		if (typeof body.dispatchVideoUrl === "string") {
			order.dispatchVideoUrl = body.dispatchVideoUrl.trim().slice(0, DISPATCH_VIDEO_URL_MAX);
			detailParts.push("Dispatch video updated");
		}
		if (body.estimatedDeliveryAt !== undefined) {
			const raw = body.estimatedDeliveryAt;
			const value = typeof raw === "string" && raw.length > 0 ? new Date(raw) : undefined;
			if (value && Number.isNaN(value.getTime())) {
				return badRequest("Invalid estimatedDeliveryAt date.");
			}
			order.estimatedDeliveryAt = value;
			detailParts.push("ETA updated");
		}

		if (Array.isArray(body.items) && body.items.length > 0) {
			const productIds = [...new Set(body.items.map((item) => item.productId).filter((productId) => isValidId(productId)))];
			const productDocs =
				productIds.length > 0
					? await Product.find({ _id: { $in: productIds } })
							.select({ variants: 1 })
							.lean<Array<{ _id: { toString(): string }; variants?: Array<{ _id: { toString(): string } }> }>>()
					: [];
			const productById = new Map(productDocs.map((product) => [product._id.toString(), product]));

			const newItems = [];
			const stockLines: Array<{ productId: string; variantId: string; quantity: number }> = [];
			for (const item of body.items) {
				if (!isValidId(item.productId) || !isValidId(item.variantId)) {
					return badRequest("Each item needs a valid productId and variantId.");
				}
				const unitPriceRupees = Number(item.unitPriceRupees);
				const quantity = Number(item.quantity);
				if (!Number.isFinite(unitPriceRupees) || unitPriceRupees < 0) {
					return badRequest("Item price must be a non-negative number.");
				}
				if (!Number.isInteger(quantity) || quantity < 1) {
					return badRequest("Item quantity must be a whole number of at least 1.");
				}

				const productDoc = productById.get(item.productId);
				if (productDoc) {
					const variantExists = (productDoc.variants ?? []).some((variant) => variant._id.toString() === item.variantId);
					if (!variantExists) {
						return badRequest(`Variant not found for "${item.productName}". Choose a valid catalog variant or remove the line.`);
					}
					stockLines.push({
						productId: item.productId,
						variantId: item.variantId,
						quantity,
					});
				}

				newItems.push({
					productId: item.productId,
					variantId: item.variantId,
					productName: String(item.productName ?? "").slice(0, 160),
					variantSummary: String(item.variantSummary ?? "").slice(0, 200),
					unitPriceRupees,
					quantity,
				});
			}

			if (order.inventoryReserved) {
				if (stockLines.length > 0) {
					const swap = await reserveStock(stockLines);
					if (!swap.ok) {
						return conflict("Not enough stock to apply the edited items.");
					}
				}
				await releaseStock(
					order.items.map((line) => ({
						productId: line.productId,
						variantId: line.variantId,
						quantity: line.quantity,
					})),
				);
			}

			order.set("items", newItems);
			const subtotal = newItems.reduce((acc, item) => acc + item.unitPriceRupees * item.quantity, 0);
			order.totals.subtotalRupees = subtotal;
			order.totals.totalRupees = Math.max(
				0,
				subtotal +
					(order.totals?.shippingRupees ?? 0) -
					(order.totals?.discountRupees ?? 0) +
					(order.totals?.paymentSurchargeRupees ?? 0) -
					pointsToRupees(order.pointsRedeemed),
			);

			order.timeline.push({
				status: order.status,
				occurredAt: new Date(),
				note: "Order updated: Items modified.",
			});
			detailParts.push("Items modified");
		}

		if (body.address && typeof body.address === "object") {
			const addressInput = body.address as Record<string, unknown>;
			const recipientName = typeof addressInput.recipientName === "string" ? addressInput.recipientName : "";
			const phoneNumber = typeof addressInput.phoneNumber === "string" ? addressInput.phoneNumber : "";
			const city = typeof addressInput.city === "string" ? addressInput.city : "";
			if (recipientName && phoneNumber && city) {
				order.address = {
					recipientName: recipientName.slice(0, 120),
					phoneNumber: phoneNumber.slice(0, 32),
					city: city.slice(0, 80),
					area: typeof addressInput.area === "string" && addressInput.area ? addressInput.area.slice(0, 120) : undefined,
					street: typeof addressInput.street === "string" && addressInput.street ? addressInput.street.slice(0, 200) : undefined,
					postalCode: typeof addressInput.postalCode === "string" && addressInput.postalCode ? addressInput.postalCode.slice(0, 16) : undefined,
				};
				detailParts.push("Address updated");
			}
		}

		if (typeof body.payment === "string" && (["bank-transfer", "card", "cod"] as const).includes(body.payment as "bank-transfer" | "card" | "cod")) {
			if (order.payment !== body.payment) {
				const previousPayment = order.payment;
				order.payment = body.payment as PaymentMethod;
				detailParts.push(`Payment → ${previousPayment} to ${body.payment}`);
			}
		}

		if (typeof body.delivery === "string" && ["courier", "pickup"].includes(body.delivery)) {
			if (order.delivery !== body.delivery) {
				const previousDelivery = order.delivery;
				order.delivery = body.delivery as DeliveryMethod;
				detailParts.push(`Delivery → ${previousDelivery} to ${body.delivery}`);
			}
		}

		if (nextStatus) {
			const claimed = await claimOrderStatusTransition({
				orderId: order._id,
				fromStatuses: [previousStatus],
				toStatus: nextStatus,
				timelineNote: typeof body.timelineNote === "string" ? body.timelineNote.slice(0, FIELD_LIMITS.operatorNote) : undefined,
			});
			if (!claimed) {
				return conflict("This order was updated by someone else. Refresh and try again.");
			}
			order.status = claimed.status;
			order.timeline = claimed.timeline;
			order.markModified("timeline");
		}

		await order.save();

		// Side-effects: stock reservation/release and loyalty credit/reversal.
		// Best-effort — failures are logged but do not roll back the status update,
		// because the human admin is the source of truth for order state.
		if (nextStatus) {
			await applyOrderTransition({
				order,
				previousStatus,
				nextStatus,
				actor,
			});
			const notifyEvent = nextStatus === "cancelled" ? "cancelled" : "status_changed";
			void fireOrderEventNotifications({
				event: notifyEvent,
				order,
				previousStatus,
				nextStatus,
			}).catch(() => undefined);
		}

		await recordActivity({
			actor,
			action: nextStatus ? "status_changed" : "updated",
			resourceType: "order",
			resourceId: id,
			resourceLabel: order.orderNumber,
			detail: detailParts.join(" · ") || undefined,
		});
		// Status changes flip dashboard KPIs (orders-today, sales, pending,
		// dispatched, refunds). Bust the admin cache so the operator sees
		// their action reflected on the very next page load.
		bustAdminCaches();

		return ok(toOrderResponse(order.toObject() as unknown as OrderLean));
	} catch (error) {
		return handleMongoError(error);
	}
}

/**
 * Hard-delete an order. Used by the admin to clear out test / legacy /
 * accidentally-created orders.
 *
 * Side-effect handling: orders hold stock from placement until they reach a
 * terminal state, and `delivered` orders have credited loyalty. So unless the
 * order is already cancelled/refunded, we first run the `cancelled` transition
 * (releasing reserved stock and reversing any loyalty credit), then hard-delete
 * the document. This keeps the catalog and customer balances accurate.
 *
 * Gated by `order_delete` — only `owner` role today.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
	const { actor, response } = await requireSession("order_delete");
	if (response) {
		return response;
	}

	const { id } = await params;
	if (!isValidId(id)) {
		return badRequest("Invalid ID.");
	}

	await connectDB();
	try {
		const order = await Order.findById(id);
		if (!order) {
			return notFound("Order not found");
		}

		const orderNumber = order.orderNumber;
		const previousStatus = order.status;
		if (previousStatus !== "cancelled" && previousStatus !== "refunded") {
			// Run the same side-effect ledger we'd run on a normal cancel so we
			// don't leak reserved stock or strand loyalty credits.
			await applyOrderTransition({
				order,
				previousStatus,
				nextStatus: "cancelled",
				actor,
			});
		}

		await order.deleteOne();

		await recordActivity({
			actor,
			action: "deleted",
			resourceType: "order",
			resourceId: id,
			resourceLabel: orderNumber,
			detail: `was ${previousStatus}`,
		});
		bustAdminCaches();

		return noContent();
	} catch (error) {
		return handleMongoError(error);
	}
}
